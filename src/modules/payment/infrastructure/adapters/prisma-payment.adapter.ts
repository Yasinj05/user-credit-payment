import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PaymentEvent,
  PaymentRequest,
  PaymentStatus,
} from '@prisma/client';
import { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PrismaPaymentAdapter implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    amount: number;
    reference: string;
    description?: string;
    idempotencyKey?: string;
  }): Promise<PaymentRequest> {
    return this.prisma.$transaction(async (transactionClient) => {
      const paymentRequest = await transactionClient.paymentRequest.create({
        data: {
          userId: data.userId,
          amount: new Prisma.Decimal(data.amount),
          reference: data.reference,
          description: data.description,
          idempotencyKey: data.idempotencyKey,
          status: PaymentStatus.QUEUED,
        },
      });

      await transactionClient.paymentEvent.createMany({
        data: [
          {
            paymentRequestId: paymentRequest.id,
            event: 'Created',
          },
          {
            paymentRequestId: paymentRequest.id,
            event: 'Queued',
          },
        ],
      });

      return paymentRequest;
    });
  }

  findById(id: string): Promise<PaymentRequest | null> {
    return this.prisma.paymentRequest.findUnique({ where: { id } });
  }

  findByReference(reference: string): Promise<PaymentRequest | null> {
    return this.prisma.paymentRequest.findUnique({ where: { reference } });
  }

  async recordEvent(
    paymentRequestId: string,
    event: string,
    metadata?: unknown,
  ): Promise<void> {
    await this.prisma.paymentEvent.create({
      data: {
        paymentRequestId,
        event,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  getEvents(paymentRequestId: string): Promise<PaymentEvent[]> {
    return this.prisma.paymentEvent.findMany({
      where: { paymentRequestId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
