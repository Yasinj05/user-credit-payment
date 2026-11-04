import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email', example: 'user1@example.com' },
    name: { type: 'string', example: 'Test User One' },
    balance: { type: 'string', example: '500.00' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const rechargeSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: {
          type: 'string',
          format: 'email',
          example: 'user1@example.com',
        },
        name: { type: 'string', example: 'Test User One' },
        balance: { type: 'string', example: '600.00' },
      },
    },
    transaction: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        amount: { type: 'string', example: '100.00' },
        type: { type: 'string', enum: ['DEBIT', 'CREDIT'], example: 'CREDIT' },
        reference: {
          type: 'string',
          example: 'RECHARGE-1730000000000-a1b2c3d4',
        },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};

const idParam = ApiParam({
  name: 'id',
  format: 'uuid',
  example: '550e8400-e29b-41d4-a716-446655440000',
});

export function ApiListUsersDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'List all users' }),
    ApiResponse({
      status: 200,
      description: 'Users returned successfully',
      schema: { type: 'array', items: userSchema },
    }),
  );
}

export function ApiGetUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get a user by id' }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'User returned successfully',
      schema: userSchema,
    }),
    ApiResponse({ status: 400, description: 'Invalid UUID format' }),
    ApiResponse({ status: 404, description: 'User not found' }),
  );
}

export function ApiRechargeUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Recharge a user balance' }),
    idParam,
    ApiResponse({
      status: 200,
      description: 'Balance recharged successfully',
      content: {
        'application/json': {
          example: {
            user: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              email: 'user1@example.com',
              name: 'Test User One',
              balance: '600.00',
            },
            transaction: {
              id: '750e8400-e29b-41d4-a716-446655440000',
              userId: '550e8400-e29b-41d4-a716-446655440000',
              amount: '100.00',
              type: 'CREDIT',
              reference: 'RECHARGE-1730000000000-a1b2c3d4',
              createdAt: '2026-11-03T18:00:00.000Z',
            },
          },
        },
      },
      schema: rechargeSchema,
    }),
    ApiResponse({ status: 400, description: 'Invalid recharge amount' }),
    ApiResponse({ status: 404, description: 'User not found' }),
  );
}
