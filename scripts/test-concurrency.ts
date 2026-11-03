import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const paymentCount = 10;
const paymentAmount = 50;
const initialBalance = 200;
const pollIntervalMs = 500;
const pollTimeoutMs = 60_000;

type PaymentStatus =
  'PENDING' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

type PaymentResponse = {
  id: string;
  status: PaymentStatus;
};

async function main(): Promise<void> {
  const testUser = await prisma.user.create({
    data: {
      email: `concurrency-${randomUUID()}@example.com`,
      name: 'Concurrency Test User',
      balance: new Prisma.Decimal(initialBalance),
    },
  });
  const paymentIds: string[] = [];

  try {
    const submissions = await Promise.all(
      Array.from({ length: paymentCount }, (_, index) =>
        submitPayment(testUser.id, index),
      ),
    );
    paymentIds.push(...submissions.map((payment) => payment.id));

    const payments = await waitForTerminalPayments(paymentIds);
    const successful = payments.filter(
      (payment) => payment.status === 'SUCCEEDED',
    ).length;
    const failed = payments.filter(
      (payment) => payment.status === 'FAILED',
    ).length;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: testUser.id },
      select: { balance: true },
    });
    const finalBalance = new Prisma.Decimal(user.balance.toString());
    const passed =
      successful === 4 &&
      failed === 6 &&
      finalBalance.equals(new Prisma.Decimal(0));

    console.table([
      {
        metric: 'Total requests',
        expected: paymentCount,
        actual: payments.length,
      },
      { metric: 'Succeeded', expected: 4, actual: successful },
      { metric: 'Failed', expected: 6, actual: failed },
      {
        metric: 'Final balance',
        expected: '0.00',
        actual: finalBalance.toFixed(2),
      },
      {
        metric: 'Result',
        expected: 'PASSED',
        actual: passed ? 'PASSED' : 'FAILED',
      },
    ]);

    if (!passed) {
      throw new Error('Concurrency stress test did not meet expected results');
    }
  } finally {
    await cleanup(testUser.id, paymentIds);
  }
}

async function submitPayment(
  userId: string,
  index: number,
): Promise<PaymentResponse> {
  const response = await fetch(`${apiUrl}/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId,
      amount: paymentAmount,
      reference: `CONCURRENCY-${randomUUID()}-${index}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Payment submission failed with HTTP ${response.status}`);
  }

  return (await response.json()) as PaymentResponse;
}

async function waitForTerminalPayments(
  ids: string[],
): Promise<PaymentResponse[]> {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    const payments = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`${apiUrl}/payments/${id}`);
        if (!response.ok) {
          throw new Error(`Payment lookup failed with HTTP ${response.status}`);
        }
        return (await response.json()) as PaymentResponse;
      }),
    );

    if (
      payments.every(
        (payment) =>
          payment.status === 'SUCCEEDED' || payment.status === 'FAILED',
      )
    ) {
      return payments;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Timed out waiting for payment processing');
}

async function cleanup(userId: string, paymentIds: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.deleteMany({
      where: { paymentRequestId: { in: paymentIds } },
    });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.paymentRequest.deleteMany({ where: { id: { in: paymentIds } } });
    await tx.user.delete({ where: { id: userId } });
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
