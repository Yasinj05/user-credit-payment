import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

const idParam = ApiParam({
  name: 'id',
  format: 'uuid',
  example: '550e8400-e29b-41d4-a716-446655440000',
});

const userListSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email', example: 'user1@example.com' },
    name: { type: 'string', example: 'Test User One' },
    balance: { type: 'string', example: '500.00' },
    createdAt: { type: 'string', format: 'date-time' },
    _count: {
      type: 'object',
      properties: { transactions: { type: 'integer', example: 3 } },
    },
  },
};

const accountDetailsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email', example: 'user1@example.com' },
    name: { type: 'string', example: 'Test User One' },
    balance: { type: 'string', example: '425.00' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          amount: { type: 'string', example: '75.00' },
          type: { type: 'string', enum: ['DEBIT', 'CREDIT'], example: 'DEBIT' },
          reference: { type: 'string', example: 'ORDER-2026-0001' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export function ApiAdminAggregatesDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get transaction aggregates by period' }),
    ApiResponse({
      status: 200,
      description: 'Aggregates returned successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              format: 'date-time',
              example: '2026-11-01T00:00:00.000Z',
            },
            debitTotal: { type: 'string', example: '150.00' },
            creditTotal: { type: 'string', example: '600.00' },
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid period query parameter' }),
  );
}

export function ApiAdminUsersDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'List users with current balances' }),
    ApiResponse({
      status: 200,
      description: 'Users returned successfully',
      schema: { type: 'array', items: userListSchema },
    }),
  );
}

export function ApiAdminUserTransactionsDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get a user account and transaction history' }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'Account details returned successfully',
      schema: accountDetailsSchema,
    }),
    ApiResponse({ status: 400, description: 'Invalid UUID format' }),
    ApiResponse({ status: 404, description: 'User not found' }),
  );
}

export function ApiAdminUsageDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get debit usage grouped by user' }),
    ApiResponse({
      status: 200,
      description: 'Usage returned successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            _sum: {
              type: 'object',
              properties: { amount: { type: 'string', example: '275.00' } },
            },
          },
        },
      },
    }),
  );
}
