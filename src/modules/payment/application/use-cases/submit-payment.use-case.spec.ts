import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SubmitPaymentUseCase } from './submit-payment.use-case';
import type { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';
import type { QueuePort } from '../../domain/ports/queue.port';
import { UsersService } from '../../../users/users.service';

describe('SubmitPaymentUseCase', () => {
  let useCase: SubmitPaymentUseCase;
  let paymentRepository: jest.Mocked<PaymentRepositoryPort>;
  let queue: jest.Mocked<QueuePort>;
  let usersService: { getUser: jest.Mock };
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    quit: jest.Mock;
  };

  const input = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 75.5,
    reference: 'ORDER-2026-0001',
    description: 'Payment for order 0001',
    idempotencyKey: 'checkout-0001',
  };
  const payment = {
    id: '650e8400-e29b-41d4-a716-446655440000',
    userId: input.userId,
    amount: new Prisma.Decimal(input.amount),
    reference: input.reference,
    description: input.description,
    status: 'QUEUED' as const,
    failureReason: null,
    retryCount: 0,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    paymentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByReference: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      recordEvent: jest.fn(),
      getEvents: jest.fn(),
    };
    queue = {
      publishPaymentJob: jest.fn(),
      consumePaymentJobs: jest.fn(),
    };
    usersService = { getUser: jest.fn() };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitPaymentUseCase,
        { provide: 'PAYMENT_REPOSITORY_PORT', useValue: paymentRepository },
        { provide: 'QUEUE_PORT', useValue: queue },
        { provide: UsersService, useValue: usersService },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    useCase = module.get(SubmitPaymentUseCase);
  });

  it('submits a queued payment and dispatches its job', async () => {
    usersService.getUser.mockResolvedValue({ id: input.userId });
    paymentRepository.create.mockResolvedValue(payment);

    await expect(useCase.execute(input)).resolves.toEqual(payment);

    expect(usersService.getUser.mock.calls).toEqual([[input.userId]]);
    expect(paymentRepository.create.mock.calls).toEqual([[input]]);
    expect(queue.publishPaymentJob.mock.calls).toEqual([
      [
        {
          paymentRequestId: payment.id,
          userId: payment.userId,
          amount: input.amount.toString(),
          reference: payment.reference,
        },
      ],
    ]);
    expect(redis.set).toHaveBeenCalledTimes(2);
  });

  it('returns a cached payment without creating or queueing it', async () => {
    const cachedPayment = JSON.parse(JSON.stringify(payment)) as typeof payment;
    redis.get
      .mockResolvedValueOnce(JSON.stringify(cachedPayment))
      .mockResolvedValueOnce(null);

    await expect(useCase.execute(input)).resolves.toEqual(cachedPayment);

    expect(usersService.getUser.mock.calls).toHaveLength(0);
    expect(paymentRepository.create.mock.calls).toHaveLength(0);
    expect(queue.publishPaymentJob.mock.calls).toHaveLength(0);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    usersService.getUser.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(paymentRepository.create.mock.calls).toHaveLength(0);
    expect(queue.publishPaymentJob.mock.calls).toHaveLength(0);
  });

  it('recovers an existing payment after a unique constraint conflict', async () => {
    usersService.getUser.mockResolvedValue({ id: input.userId });
    paymentRepository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate payment', {
        code: 'P2002',
        clientVersion: '6.19.0',
        meta: { target: ['reference'] },
      }),
    );
    paymentRepository.findByReference.mockResolvedValue(payment);

    await expect(useCase.execute(input)).resolves.toEqual(payment);

    expect(paymentRepository.findByReference.mock.calls).toEqual([
      [input.reference],
    ]);
    expect(queue.publishPaymentJob.mock.calls).toHaveLength(0);
    expect(redis.set).toHaveBeenCalledTimes(2);
  });
});
