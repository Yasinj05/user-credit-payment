import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AggregateReportQueryDto } from './dto/aggregate-report-query.dto';

@ApiTags('Admin Reports')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports/aggregates')
  @ApiOperation({ summary: 'Get transaction aggregates by period' })
  @ApiResponse({
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
  })
  getAggregates(@Query() query: AggregateReportQueryDto) {
    return this.adminService.getAggregates(query.period);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with current balances' })
  @ApiResponse({
    status: 200,
    description: 'Users returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: {
            type: 'string',
            format: 'email',
            example: 'user1@example.com',
          },
          name: { type: 'string', example: 'Test User One' },
          balance: { type: 'string', example: '500.00' },
          createdAt: { type: 'string', format: 'date-time' },
          _count: {
            type: 'object',
            properties: { transactions: { type: 'integer', example: 3 } },
          },
        },
      },
    },
  })
  listUsers() {
    return this.adminService.listUsersWithBalances();
  }

  @Get('users/:id/transactions')
  @ApiOperation({ summary: 'Get a user account and transaction history' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Account details returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: {
          type: 'string',
          format: 'email',
          example: 'user1@example.com',
        },
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
              type: {
                type: 'string',
                enum: ['DEBIT', 'CREDIT'],
                example: 'DEBIT',
              },
              reference: { type: 'string', example: 'ORDER-2026-0001' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserTransactions(@Param('id') userId: string) {
    return this.adminService.getUserAccountDetails(userId);
  }

  @Get('reports/usage')
  @ApiOperation({ summary: 'Get debit usage grouped by user' })
  @ApiResponse({
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
  })
  getUsage() {
    return this.adminService.getBalanceUsagePerUser();
  }
}
