import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RechargeBalanceDto } from './dto/recharge-balance.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users returned successfully' })
  listUsers() {
    return this.usersService.listUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'User returned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id') userId: string) {
    return this.usersService.getUser(userId);
  }

  @Post(':id/recharge')
  @ApiOperation({ summary: 'Recharge a user balance' })
  @ApiResponse({ status: 201, description: 'Balance recharged successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid recharge amount' })
  rechargeBalance(
    @Param('id') userId: string,
    @Body() rechargeBalanceDto: RechargeBalanceDto,
  ) {
    return this.usersService.rechargeBalance(userId, rechargeBalanceDto.amount);
  }
}
