import { Inject, Injectable } from '@nestjs/common';
import { PaymentStatus, TransactionType } from '@prisma/client';
import type { PaymentRequest } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  InsufficientBalanceError,
  TechnicalGlitchError,
} from '../../domain/errors/payment.errors';
import type { QueuePort } from '../../domain/ports/queue.port';

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('QUEUE_PORT') private readonly queue: QueuePort,
  ) {}

  async execute(paymentRequestId: string): Promise<void> {
    const payment = await this.prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });

    if (
      !payment ||
      payment.status === PaymentStatus.SUCCEEDED ||
      payment.status === PaymentStatus.FAILED
    ) {
      return;
    }

    const claimed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentRequest.updateMany({
        where: {
          id: paymentRequestId,
          status: { in: [PaymentStatus.QUEUED, PaymentStatus.PENDING] },
        },
        data: { status: PaymentStatus.PROCESSING },
      });

      if (result.count === 0) {
        return false;
      }

      await tx.paymentEvent.create({
        data: {
          paymentRequestId,
          event: 'Processing Started',
        },
      });
      return true;
    });

    if (!claimed) {
      return;
    }

    try {
      this.simulateFailure(payment);
      await this.deductBalance(payment);
    } catch (error) {
      await this.handleFailure(payment, error);
    }
  }

  private simulateFailure(payment: PaymentRequest): void {
    if (payment.reference.toUpperCase().includes('FAIL')) {
      throw new TechnicalGlitchError('Simulated forced technical error');
    }

    const probability = Math.min(Number(payment.amount) / 1000000, 0.4);
    if (Math.random() < probability) {
      throw new TechnicalGlitchError('Simulated network transient error');
    }
  }

  private async deductBalance(payment: PaymentRequest): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const affectedRows = await tx.$executeRaw`
        UPDATE "User"
        SET "balance" = "balance" - ${payment.amount},
            "updatedAt" = NOW()
        WHERE "id" = ${payment.userId}
          AND "balance" >= ${payment.amount}
      `;

      if (affectedRows === 0) {
        throw new InsufficientBalanceError('User balance is insufficient');
      }

      await tx.transaction.create({
        data: {
          userId: payment.userId,
          paymentRequestId: payment.id,
          amount: payment.amount,
          type: TransactionType.DEBIT,
          reference: payment.reference,
        },
      });

      await tx.paymentRequest.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED },
      });

      await tx.paymentEvent.create({
        data: {
          paymentRequestId: payment.id,
          event: 'Succeeded',
        },
      });
    });
  }

  private async handleFailure(
    payment: PaymentRequest,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof InsufficientBalanceError) {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentRequest.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: message,
          },
        });
        await tx.paymentEvent.create({
          data: {
            paymentRequestId: payment.id,
            event: 'Failed',
            metadata: { reason: message, isBusinessError: true },
          },
        });
      });
      return;
    }

    if (payment.retryCount < 3) {
      const attempt = payment.retryCount + 1;
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentRequest.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.QUEUED,
            retryCount: { increment: 1 },
          },
        });
        await tx.paymentEvent.create({
          data: {
            paymentRequestId: payment.id,
            event: 'Retry Triggered',
            metadata: { attempt, error: message },
          },
        });
      });

      await this.delay(2000 * attempt);
      await this.queue.publishPaymentJob({
        paymentRequestId: payment.id,
        userId: payment.userId,
        amount: payment.amount.toString(),
        reference: payment.reference,
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: `Max retry attempts exceeded: ${message}`,
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentRequestId: payment.id,
          event: 'Failed',
          metadata: { reason: 'Exhausted retries' },
        },
      });
    });
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
