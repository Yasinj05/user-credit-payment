import { PaymentEvent, PaymentRequest } from '@prisma/client';

export interface PaymentRepositoryPort {
  create(data: {
    userId: string;
    amount: number;
    reference: string;
    description?: string;
    idempotencyKey?: string;
  }): Promise<PaymentRequest>;
  findById(id: string): Promise<PaymentRequest | null>;
  findByReference(reference: string): Promise<PaymentRequest | null>;
  findByIdempotencyKey?(idempotencyKey: string): Promise<PaymentRequest | null>;
  recordEvent(
    paymentRequestId: string,
    event: string,
    metadata?: unknown,
  ): Promise<void>;
  getEvents(paymentRequestId: string): Promise<PaymentEvent[]>;
}
