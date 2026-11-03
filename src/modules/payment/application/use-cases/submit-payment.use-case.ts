import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PaymentRequest } from '@prisma/client';
import Redis from 'ioredis';
import { UsersService } from '../../../users/users.service';
import type { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';
import type { QueuePort } from '../../domain/ports/queue.port';

export interface SubmitPaymentInput {
  userId: string;
  amount: number;
  reference: string;
  description?: string;
  idempotencyKey?: string;
}

@Injectable()
export class SubmitPaymentUseCase implements OnModuleDestroy {
  constructor(
    @Inject('PAYMENT_REPOSITORY_PORT')
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject('QUEUE_PORT')
    private readonly queue: QueuePort,
    private readonly usersService: UsersService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async execute(input: SubmitPaymentInput): Promise<PaymentRequest> {
    const cachedPayment = await this.getCachedPayment(input);
    if (cachedPayment) {
      return cachedPayment;
    }

    await this.usersService.getUser(input.userId);

    let paymentRequest: PaymentRequest;
    try {
      paymentRequest = await this.paymentRepository.create(input);
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }

      const existingPayment = await this.findExistingPayment(input);
      if (!existingPayment) {
        throw error;
      }

      await this.cachePayment(input, existingPayment);
      return existingPayment;
    }

    await this.cachePayment(input, paymentRequest);
    await this.queue.publishPaymentJob({
      paymentRequestId: paymentRequest.id,
      userId: paymentRequest.userId,
      amount: paymentRequest.amount.toString(),
      reference: paymentRequest.reference,
    });

    return paymentRequest;
  }

  private async findExistingPayment(
    input: SubmitPaymentInput,
  ): Promise<PaymentRequest | null> {
    const paymentByReference = await this.paymentRepository.findByReference(
      input.reference,
    );
    if (paymentByReference) {
      return paymentByReference;
    }

    if (input.idempotencyKey) {
      return this.paymentRepository.findByIdempotencyKey(input.idempotencyKey);
    }

    return null;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      this.isPaymentUniquenessTarget(error.meta?.target)
    );
  }

  private isPaymentUniquenessTarget(target: unknown): boolean {
    if (Array.isArray(target)) {
      return target.some(
        (field) => field === 'reference' || field === 'idempotencyKey',
      );
    }

    return target === 'reference' || target === 'idempotencyKey';
  }

  private async getCachedPayment(
    input: SubmitPaymentInput,
  ): Promise<PaymentRequest | null> {
    const keys = this.getCacheKeys(input);
    for (const key of keys) {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as PaymentRequest;
      }
    }

    return null;
  }

  private async cachePayment(
    input: SubmitPaymentInput,
    paymentRequest: PaymentRequest,
  ): Promise<void> {
    const serialized = JSON.stringify(paymentRequest);
    await Promise.all(
      this.getCacheKeys(input).map((key) =>
        this.redis.set(key, serialized, 'EX', 86400),
      ),
    );
  }

  private getCacheKeys(input: SubmitPaymentInput): string[] {
    const keys = [`payment:reference:${input.reference}`];
    if (input.idempotencyKey) {
      keys.unshift(`payment:idempotency:${input.idempotencyKey}`);
    }
    return keys;
  }
}
