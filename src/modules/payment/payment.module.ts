import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { SubmitPaymentUseCase } from './application/use-cases/submit-payment.use-case';
import { PrismaPaymentAdapter } from './infrastructure/adapters/prisma-payment.adapter';
import { RabbitMqQueueAdapter } from './infrastructure/adapters/rabbitmq-queue.adapter';
import { PaymentController } from './infrastructure/controllers/payment.controller';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [PaymentController],
  providers: [
    {
      provide: 'PAYMENT_REPOSITORY_PORT',
      useClass: PrismaPaymentAdapter,
    },
    {
      provide: 'QUEUE_PORT',
      useClass: RabbitMqQueueAdapter,
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: () =>
        new Redis(process.env.REDIS_URL as string, {
          lazyConnect: true,
        }),
    },
    SubmitPaymentUseCase,
  ],
  exports: [SubmitPaymentUseCase, 'PAYMENT_REPOSITORY_PORT', 'QUEUE_PORT'],
})
export class PaymentModule {}
