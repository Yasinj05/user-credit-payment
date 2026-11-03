import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RechargeBalanceDto } from './dto/recharge-balance.dto';
import {
  ApiGetUserDocs,
  ApiListUsersDocs,
  ApiRechargeUserDocs,
} from './users.docs';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiListUsersDocs()
  listUsers() {
    return this.usersService.listUsers();
  }

  @Get(':id')
  @ApiGetUserDocs()
  getUser(@Param('id') userId: string) {
    return this.usersService.getUser(userId);
  }

  @Post(':id/recharge')
  @ApiRechargeUserDocs()
  rechargeBalance(
    @Param('id') userId: string,
    @Body() rechargeBalanceDto: RechargeBalanceDto,
  ) {
    return this.usersService.rechargeBalance(userId, rechargeBalanceDto.amount);
  }
}
