import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { QueuePort } from '../../domain/ports/queue.port';
import { ProcessPaymentUseCase } from '../../application/use-cases/process-payment.use-case';

@Injectable()
export class PaymentConsumer implements OnModuleInit {
  constructor(
    @Inject('QUEUE_PORT') private readonly queue: QueuePort,
    private readonly processPayment: ProcessPaymentUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.consumePaymentJobs(async ({ paymentRequestId }) => {
      await this.processPayment.execute(paymentRequestId);
    });
  }
}
