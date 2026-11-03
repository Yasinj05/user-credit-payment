# User Credit Payment

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)

High-performance, fault-tolerant asynchronous credit payment processing engine built with NestJS, PostgreSQL, Prisma, RabbitMQ, and Redis.

The service accepts payment requests synchronously, persists them as queued work, and processes them asynchronously. Monetary operations are performed with PostgreSQL `DECIMAL(14, 2)` values and concurrency-safe conditional updates, ensuring that an account can never be overdrawn by competing workers.

## Core capabilities

- Hexagonal Architecture (Ports & Adapters) around the payment domain
- Atomic balance deductions with database-enforced sufficient-funds checks
- Idempotency safeguards using payment references and optional idempotency keys
- Payment lifecycle event ledger with timestamps and metadata
- Categorized business and technical failure policies
- Exponential retry handling for transient technical failures
- Durable RabbitMQ payment processing
- Redis-backed idempotency caching
- Periodic transaction aggregates and administrative reports
- Automated concurrency stress testing

## Architecture

```text
                         HTTP clients
                              |
                              v
                    +---------------------+
                    | NestJS Controllers  |
                    | Users / Payments   |
                    | Admin Reports      |
                    +----------+----------+
                               |
                 +-------------+-------------+
                 |                           |
                 v                           v
       +---------------------+     +----------------------+
       | Users / Admin       |     | Payment Application  |
       | NestJS services     |     | SubmitPayment        |
       |                     |     | ProcessPayment       |
       +----------+----------+     +-----+-----------+----+
                  |                      |           |
                  |                      | Ports     | Ports
                  |                      v           v
                  |             +------------+  +------------+
                  |             | Repository |  | Queue      |
                  |             | Port       |  | Port       |
                  |             +------+-----+  +------+-----+
                  |                    |               |
                  v                    v               v
             PostgreSQL       Prisma Adapter   RabbitMQ Adapter
             via Prisma       PaymentEvent     payment_process_queue
                                      |
                                      v
                              Payment Consumer
                                      |
                                      v
                              ProcessPayment
```

### Hexagonal payment architecture

Hexagonal Architecture is intentionally concentrated in [`src/modules/payment`](./src/modules/payment). Payment processing has the highest correctness requirements and the most important external boundaries:

```text
src/modules/payment/
├── domain/
│   ├── errors/
│   │   └── payment.errors.ts
│   └── ports/
│       ├── payment.repository.port.ts
│       └── queue.port.ts
├── application/
│   └── use-cases/
│       ├── submit-payment.use-case.ts
│       └── process-payment.use-case.ts
├── infrastructure/
│   ├── adapters/
│   │   ├── prisma-payment.adapter.ts
│   │   └── rabbitmq-queue.adapter.ts
│   ├── consumers/
│   │   └── payment.consumer.ts
│   └── controllers/
│       └── payment.controller.ts
└── payment.module.ts
```

- **Domain layer** contains business errors and technology-independent ports. `InsufficientBalanceError` represents a business failure and is non-retryable. `TechnicalGlitchError` represents a transient technical failure and is retryable.
- **Application layer** contains standalone use cases. `SubmitPaymentUseCase` validates and queues payment work. `ProcessPaymentUseCase` owns payment state transitions, failure classification, retries, and atomic deduction.
- **Infrastructure layer** contains replaceable integrations: `PrismaPaymentAdapter`, `RabbitMqQueueAdapter`, the HTTP controller, and the RabbitMQ consumer.

The `users` and `admin` modules use standard NestJS modular services because their responsibilities are straightforward CRUD and reporting operations. Applying ports and adapters to every simple query would add ceremony without improving the key consistency boundary. This split is deliberate pragmatism: strong isolation where payment correctness depends on it, conventional NestJS where it improves delivery and readability.

## Concurrency safety and double-deduction guarantee

A naive read-modify-write implementation is unsafe:

1. Worker A reads balance `50`.
2. Worker B reads balance `50`.
3. Both workers decide that a `50` payment is affordable.
4. Both write a result, potentially causing a duplicate deduction or a negative balance.

Payment processing instead performs the deduction inside a PostgreSQL transaction using one conditional update:

```sql
UPDATE "User"
SET
  "balance" = "balance" - $amount,
  "updatedAt" = NOW()
WHERE
  "id" = $userId
  AND "balance" >= $amount;
```

The worker checks the affected-row count:

- `1` row means the balance reservation succeeded and the debit transaction can be recorded.
- `0` rows means the user does not exist or no longer has sufficient funds; the operation becomes a business failure.

The balance update, debit transaction, payment status update, and success event are committed in one database transaction. PostgreSQL row-level locking serializes competing updates, so concurrent workers cannot both deduct the same available funds. This provides a zero-double-spending guarantee at the database boundary and ensures the balance cannot become negative.

## Asynchronous queue and event audit trail

Payment submission returns quickly after the request is persisted and queued:

```text
POST /payments
      |
      v
PaymentRequest: QUEUED
      |
      +--> PaymentEvent: Created
      +--> PaymentEvent: Queued
      |
      v
RabbitMQ: payment_process_queue
      |
      v
PaymentConsumer
      |
      v
ProcessPaymentUseCase
```

RabbitMQ is configured with:

- Durable queue: `payment_process_queue`
- Persistent messages (`deliveryMode: 2`)
- Durable infrastructure volumes in Docker Compose

The normal lifecycle is:

```text
PENDING -> QUEUED -> PROCESSING -> SUCCEEDED
                                  \
                                   -> FAILED
```

`PaymentEvent` is the append-only lifecycle ledger for each payment request. It records events such as:

- `Created`
- `Queued`
- `Processing Started`
- `Succeeded`
- `Failed`
- `Retry Triggered`

Each event includes its creation timestamp and optional JSON metadata, providing an operational audit trail independent of the current status stored on `PaymentRequest`.

## Error categorization and retry policy

### Business failures

Insufficient funds are represented by `InsufficientBalanceError`. This is an expected business outcome:

- Payment is immediately marked `FAILED`.
- `failureReason` is persisted.
- A `Failed` event records the reason and `isBusinessError: true`.
- No retry is scheduled.

Avoiding retries conserves worker and database capacity because retrying cannot create funds.

### Technical failures

Transient database, network, or simulated technical failures are handled as retryable errors. A reference containing `FAIL` triggers the deterministic simulation:

```text
Simulated forced technical error
```

Technical failures are retried up to three times. Retry attempts use exponential backoff:

```text
delay = 2000ms * attempt
```

Each retry increments `retryCount`, returns the request to `QUEUED`, writes a `Retry Triggered` event, and republishes the job. When retries are exhausted, the payment is marked `FAILED` with a persisted failure reason and an `Exhausted retries` event.

## Quick start

### Prerequisites

- Docker and Docker Compose
- Node.js 18 or newer
- npm

### Install dependencies

```bash
npm install
```

### Configure the environment

Copy the example environment file:

```bash
cp .env.example .env
```

The local Docker Compose host mappings are:

| Service | Host address | Container address |
|---|---:|---:|
| PostgreSQL | `localhost:5434` | `5432` |
| RabbitMQ AMQP | `localhost:5672` | `5672` |
| RabbitMQ Management | `localhost:15672` | `15672` |
| Redis | `localhost:6380` | `6379` |

The `.env` values must use the host addresses when the NestJS application runs directly on the host. When the application is containerized later, use the Compose service names and container ports instead.

### Start infrastructure

```bash
docker-compose up -d
```

Verify service health:

```bash
docker-compose ps
```

### Initialize the database

```bash
npx prisma migrate dev
npx prisma db seed
```

The seed creates three test users with starting balances of `500.00`, `100.00`, and `0.00`.

### Start the API

```bash
npm run start:dev
```

The API listens on `http://localhost:3000`.

- Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- RabbitMQ Management UI: [http://localhost:15672](http://localhost:15672)
  - Username: `guest`
  - Password: `guest`

## Automated concurrency and stress testing

Run the end-to-end concurrency test while the API, PostgreSQL, RabbitMQ, and Redis are running:

```bash
npm run test:concurrency
```

[`scripts/test-concurrency.ts`](./scripts/test-concurrency.ts) performs the following scenario:

1. Creates a temporary user with a `200.00` balance.
2. Fires 10 simultaneous `POST /payments` requests using `Promise.all`.
3. Submits `50.00` for each payment.
4. Polls each payment until it reaches `SUCCEEDED` or `FAILED`.
5. Reads the final user balance.
6. Verifies:
   - Exactly 4 payments succeeded.
   - Exactly 6 payments failed with insufficient funds.
   - The final balance is exactly `0.00`.
7. Prints a summary table and removes the temporary records.

This test exercises the same atomic conditional update used by production payment processing and is designed to expose race conditions or double deductions.

## API surface

All routes are currently unauthenticated by design. See the interactive schemas and examples in [Swagger UI](http://localhost:3000/api-docs).

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | List users and balances. |
| `GET` | `/users/:id` | Get a user and current balance. |
| `POST` | `/users/:id/recharge` | Atomically credit a user and create a `CREDIT` transaction. |

Recharge body:

```json
{
  "amount": 100
}
```

### Payments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payments` | Accept and queue an asynchronous payment request. Returns `202 Accepted`. |
| `GET` | `/payments/:id` | Get payment status and details. |
| `GET` | `/payments/:id/events` | Get chronological lifecycle events. |

Payment submission body:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 75.5,
  "reference": "ORDER-2026-0001",
  "description": "Payment for order 0001"
}
```

Optional idempotency header:

```text
x-idempotency-key: checkout-0001
```

Repeated requests with the same reference or idempotency key return the previously cached payment instead of creating or queueing another payment.

### Admin reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/reports/aggregates?period=daily` | Aggregate debit and credit totals by day, month, or year. |
| `GET` | `/admin/users` | List users, balances, and transaction counts. |
| `GET` | `/admin/users/:id/transactions` | Get account details and transaction history. |
| `GET` | `/admin/reports/usage` | Aggregate debit usage by user. |

Money values are represented as decimal strings in Prisma-backed responses to preserve precision across JSON serialization.

## Project layout

```text
.
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── test-concurrency.ts
├── src/
│   ├── modules/
│   │   ├── admin/
│   │   ├── payment/
│   │   └── users/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml
└── package.json
```

## Development commands

```bash
npm run build                 # Compile the application
npm run start:dev             # Start in watch mode
npm test                      # Run unit tests
npm run lint                  # Run ESLint
npm run format                # Format TypeScript and test files
npm run test:concurrency      # Run the concurrency stress test
```

## Production roadmap and trade-offs

The current implementation intentionally focuses on the payment-processing requirements and does not include authentication or authorization boilerplate. In a production deployment:

- **Authentication and authorization:** add JWT or OAuth2 authentication, then apply RBAC guards around user, payment, and admin routes. Administrative reporting should require a dedicated role or permission.
- **Rate limiting:** use Redis-backed sliding-window or token-bucket rate limiting to protect payment submission and recharge endpoints.
- **Dead Letter Queue:** route permanently rejected or malformed messages to a DLQ for inspection and replay rather than discarding them.
- **Observability:** add structured logs, correlation IDs, queue depth metrics, payment latency metrics, and tracing across HTTP, RabbitMQ, Redis, and PostgreSQL.
- **Secrets and deployment:** use a managed secret store, TLS for external connections, non-default RabbitMQ credentials, and separate production Compose/Kubernetes configuration.
- **Database operations:** add migration checks in CI/CD, backups, connection pool limits, and alerting for transaction failures.
- **Operational controls:** add replay tooling, reconciliation reports, and explicit controls for handling partially completed external integrations.

These are intentional next steps rather than hidden assumptions in the current scope.
