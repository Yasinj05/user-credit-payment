# User Credit Payment

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)

An asynchronous credit payment engine built for correctness under concurrent load.
NestJS, PostgreSQL/Prisma, RabbitMQ, and Redis provide durable processing, precise
money handling, idempotency, and operational auditability.

## Quick start
Prerequisites: Docker, Node.js 18+, and npm.

```bash
npm install
cp .env.example .env
docker-compose up -d
npx prisma migrate dev && npx prisma db seed && npm run start:dev
```

Open Swagger at [http://localhost:3000/api-docs](http://localhost:3000/api-docs).
Connection values and port mappings are defined in [.env.example](./.env.example).

## Architecture
The payment module uses a pragmatic Ports & Adapters boundary:

- **Domain:** payment ports and business errors
  (`InsufficientBalanceError` and `TechnicalGlitchError`).
- **Application:** `SubmitPaymentUseCase` and `ProcessPaymentUseCase`, independent
  of Prisma and RabbitMQ.
- **Infrastructure:** Prisma and RabbitMQ adapters, HTTP controller, and queue
  consumer.

Ports & Adapters is scoped to payments, where persistence, messaging, retries,
and financial invariants create meaningful substitution boundaries. Users and
Admin remain conventional NestJS modules because ports would add ceremony
without improving their direct account and reporting operations.

Payment submission persists a request as `QUEUED`, records initial lifecycle
events, and publishes a persistent message to the durable
`payment_process_queue`. The consumer processes:

```text
PENDING -> QUEUED -> PROCESSING -> SUCCEEDED
                                  -> FAILED
```

`PaymentEvent` records state changes, retry attempts, timestamps, and failure
metadata for an auditable payment history.

## Concurrency safeguard
A read-modify-write balance update is unsafe: concurrent workers can both read
the same balance and approve deductions. Processing instead executes this
conditional update inside a PostgreSQL transaction:

```sql
UPDATE "User"
SET
  "balance" = "balance" - $amount,
  "updatedAt" = NOW()
WHERE
  "id" = $userId
  AND "balance" >= $amount;
```

The affected-row count is the authorization decision:

- **1 row:** sufficient funds were reserved; the debit transaction, payment
  status, and success event are committed atomically.
- **0 rows:** the balance was insufficient (or the user was unavailable); no
  debit is recorded and the payment becomes a business failure.

PostgreSQL row locking serializes competing updates. This prevents negative
balances and double deductions even when many workers process the same account
concurrently.

## Idempotency and race recovery
Payment references and optional `x-idempotency-key` values are unique at the
database level. Redis provides a fast 24-hour response cache, while Prisma
`P2002` unique-constraint recovery handles the race between cache lookup and
database creation:

1. Check Redis by idempotency key and reference.
2. Create the payment if no cached result exists.
3. If a concurrent request wins the database race, recover the existing record
   from the repository and cache it rather than returning an internal error.
4. Publish only for the newly created payment.

This makes retries safe without relying on cache timing as the source of truth.

## Failure classification and retries

| Category | Example | Policy |
|---|---|---|
| Business failure | Insufficient balance | Mark `FAILED` immediately; do not retry. |
| Technical failure | Transient system error or reference containing `FAIL` | Return to `QUEUED`, record `Retry Triggered`, and retry up to 3 times. |

Technical retries use exponential backoff:

```text
delay = 2000ms * attempt
```

After the third retry, the payment is marked `FAILED` with an exhausted-retry
reason. To exercise this path, use a reference containing `FAIL`, or select the
technical-glitch request body example in Swagger.

## Testing and verification

Run unit tests:

```bash
npm test
```

The payment submission suite covers queuing, cached idempotency, missing users,
and Prisma unique-constraint recovery.

Run the concurrency stress test with the API and infrastructure running:

```bash
npm run test:concurrency
```

[`scripts/test-concurrency.ts`](./scripts/test-concurrency.ts) creates a
temporary user with `200.00`, submits ten simultaneous `50.00` payments using
`Promise.all`, and polls until completion. The expected result is:

- 4 payments `SUCCEEDED`
- 6 payments `FAILED` with `User balance is insufficient`
- Final balance exactly `0.00`

The script prints a summary table and removes its temporary records.

## Production readiness trade-offs

The current scope intentionally omits authentication and authorization
boilerplate. Before production deployment:

- Add JWT/OAuth2 authentication and RBAC guards, especially for Admin routes.
- Add Redis sliding-window or token-bucket rate limiting to payment and recharge
  endpoints.
- Add a RabbitMQ Dead Letter Queue for malformed or permanently rejected jobs.
- Add structured logs, correlation IDs, queue-depth metrics, payment latency
  metrics, tracing, and alerting.
- Use managed secrets, TLS, non-default credentials, database backups,
  migration gates, and connection-pool controls.

These are explicit production extensions, not hidden dependencies of the MVP.
