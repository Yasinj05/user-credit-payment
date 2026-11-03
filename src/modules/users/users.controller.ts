import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RechargeBalanceDto } from './dto/recharge-balance.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({
    status: 200,
    description: 'Users returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user1@example.com',
          },
          name: { type: 'string', example: 'Test User One' },
          balance: { type: 'string', example: '500.00' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  listUsers() {
    return this.usersService.listUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User returned successfully',
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
        balance: { type: 'string', example: '500.00' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id') userId: string) {
    return this.usersService.getUser(userId);
  }

  @Post(':id/recharge')
  @ApiOperation({ summary: 'Recharge a user balance' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 201,
    description: 'Balance recharged successfully',
    schema: {
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
            type: {
              type: 'string',
              enum: ['DEBIT', 'CREDIT'],
              example: 'CREDIT',
            },
            reference: {
              type: 'string',
              example: 'RECHARGE-1730000000000-a1b2c3d4',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid recharge amount' })
  rechargeBalance(
    @Param('id') userId: string,
    @Body() rechargeBalanceDto: RechargeBalanceDto,
  ) {
    return this.usersService.rechargeBalance(userId, rechargeBalanceDto.amount);
  }
}
