import { applyDecorators } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const paymentSchema: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    amount: { type: 'string', example: '75.50' },
    reference: { type: 'string', example: 'ORDER-2026-0001' },
    description: { type: 'string', nullable: true },
    status: {
      type: 'string',
      enum: [
        'PENDING',
        'QUEUED',
        'PROCESSING',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
      ],
    },
    failureReason: { type: 'string', nullable: true },
    retryCount: { type: 'integer', example: 0 },
    idempotencyKey: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const paymentExample = (overrides: Record<string, unknown>) => ({
  id: '650e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  amount: '75.50',
  reference: 'ORDER-2026-0001',
  description: 'Payment for order 0001',
  status: 'QUEUED',
  failureReason: null,
  retryCount: 0,
  idempotencyKey: 'checkout-0001',
  createdAt: '2026-11-03T18:00:00.000Z',
  updatedAt: '2026-11-03T18:00:00.000Z',
  ...overrides,
});

const event = (
  id: string,
  paymentRequestId: string,
  name: string,
  metadata: Record<string, unknown> | null = null,
) => ({
  id,
  paymentRequestId,
  event: name,
  metadata,
  createdAt: '2026-11-03T18:00:00.000Z',
});

const eventTrail = {
  'Succeeded Trail': {
    summary: 'Successfully processed payment',
    value: [
      event(
        '850e8400-e29b-41d4-a716-446655440000',
        '650e8400-e29b-41d4-a716-446655440000',
        'Created',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440001',
        '650e8400-e29b-41d4-a716-446655440000',
        'Queued',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440002',
        '650e8400-e29b-41d4-a716-446655440000',
        'Processing Started',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440003',
        '650e8400-e29b-41d4-a716-446655440000',
        'Succeeded',
      ),
    ],
  },
  'Business Failure Trail': {
    summary: 'Payment failed because of insufficient funds',
    value: [
      event(
        '850e8400-e29b-41d4-a716-446655440010',
        '650e8400-e29b-41d4-a716-446655440010',
        'Created',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440011',
        '650e8400-e29b-41d4-a716-446655440010',
        'Queued',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440012',
        '650e8400-e29b-41d4-a716-446655440010',
        'Processing Started',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440013',
        '650e8400-e29b-41d4-a716-446655440010',
        'Failed',
        {
          reason: 'User balance is insufficient',
          isBusinessError: true,
        },
      ),
    ],
  },
  'Technical Retry Trail': {
    summary: 'Payment failed after technical retries',
    value: [
      event(
        '850e8400-e29b-41d4-a716-446655440020',
        '650e8400-e29b-41d4-a716-446655440020',
        'Created',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440021',
        '650e8400-e29b-41d4-a716-446655440020',
        'Queued',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440022',
        '650e8400-e29b-41d4-a716-446655440020',
        'Processing Started',
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440023',
        '650e8400-e29b-41d4-a716-446655440020',
        'Retry Triggered',
        { attempt: 1, error: 'Simulated forced technical error' },
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440024',
        '650e8400-e29b-41d4-a716-446655440020',
        'Retry Triggered',
        { attempt: 2, error: 'Simulated forced technical error' },
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440025',
        '650e8400-e29b-41d4-a716-446655440020',
        'Retry Triggered',
        { attempt: 3, error: 'Simulated forced technical error' },
      ),
      event(
        '850e8400-e29b-41d4-a716-446655440026',
        '650e8400-e29b-41d4-a716-446655440020',
        'Failed',
        { reason: 'Exhausted retries' },
      ),
    ],
  },
};

const idParam = ApiParam({
  name: 'id',
  format: 'uuid',
  example: '550e8400-e29b-41d4-a716-446655440000',
});

export function ApiSubmitPaymentDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Submit a payment request' }),
    ApiBody({
      description: 'Payment request to enqueue for asynchronous processing',
      schema: {
        type: 'object',
        required: ['userId', 'amount', 'reference'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          amount: { type: 'number', example: 50, minimum: 0.01 },
          reference: {
            type: 'string',
            example: 'ORDER-SUCCESS-001',
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Payment for order 001',
          },
        },
      },
      examples: {
        '1. Happy Path (Normal Payment)': {
          summary: 'Queue a normal payment',
          value: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 50,
            reference: 'ORDER-SUCCESS-001',
            description: 'Payment for order 001',
          },
        },
        '2. Technical Glitch (Trigger Exponential Retry)': {
          summary: 'Force three technical retries',
          value: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 30,
            reference: 'ORDER-FAIL-RETRY-001',
            description: 'Deterministic technical retry simulation',
          },
        },
        '3. Business Failure (Insufficient Balance)': {
          summary: 'Trigger an insufficient-balance failure',
          value: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 99999,
            reference: 'ORDER-OVERDRAW-001',
            description: 'Payment exceeding the available balance',
          },
        },
      },
    }),
    ApiHeader({
      name: 'x-idempotency-key',
      required: false,
      description: 'Optional key to safely retry the same request',
    }),
    ApiAcceptedResponse({
      description: 'Payment accepted and queued successfully',
      schema: paymentSchema,
    }),
    ApiResponse({
      status: 202,
      description: 'Payment accepted and queued successfully',
      content: { 'application/json': { example: paymentExample({}) } },
    }),
    ApiResponse({
      status: 400,
      description: 'Validation failed',
      content: {
        'application/json': {
          example: {
            statusCode: 400,
            message: [
              'userId must be a UUID',
              'amount must be a positive number',
            ],
            error: 'Bad Request',
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'User does not exist',
      content: {
        'application/json': {
          example: {
            statusCode: 404,
            message:
              'User with id "550e8400-e29b-41d4-a716-446655440000" not found',
            error: 'Not Found',
          },
        },
      },
    }),
  );
}

export function ApiGetPaymentDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get payment request details' }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'Payment returned successfully',
      content: {
        'application/json': {
          examples: {
            'Happy Path (SUCCEEDED)': {
              value: paymentExample({ status: 'SUCCEEDED' }),
            },
            'Business Failure': {
              value: paymentExample({
                amount: '500.00',
                status: 'FAILED',
                failureReason: 'User balance is insufficient',
                idempotencyKey: null,
              }),
            },
            'Technical Failure': {
              value: paymentExample({
                reference: 'ORDER-2026-FAIL-0003',
                status: 'FAILED',
                retryCount: 3,
                failureReason:
                  'Max retry attempts exceeded: Simulated forced technical error',
                idempotencyKey: null,
              }),
            },
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid UUID format' }),
    ApiResponse({ status: 404, description: 'Payment not found' }),
  );
}

export function ApiGetPaymentEventsDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get payment lifecycle events' }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'Events returned chronologically',
      content: { 'application/json': { examples: eventTrail } },
    }),
    ApiResponse({ status: 400, description: 'Invalid UUID format' }),
    ApiResponse({ status: 404, description: 'Payment not found' }),
  );
}
