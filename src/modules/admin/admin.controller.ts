import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AggregateReportQueryDto } from './dto/aggregate-report-query.dto';

@ApiTags('Admin Reports')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports/aggregates')
  @ApiOperation({ summary: 'Get transaction aggregates by period' })
  @ApiResponse({ status: 200, description: 'Aggregates returned successfully' })
  getAggregates(@Query() query: AggregateReportQueryDto) {
    return this.adminService.getAggregates(query.period);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with current balances' })
  @ApiResponse({ status: 200, description: 'Users returned successfully' })
  listUsers() {
    return this.adminService.listUsersWithBalances();
  }

  @Get('users/:id/transactions')
  @ApiOperation({ summary: 'Get a user account and transaction history' })
  @ApiResponse({
    status: 200,
    description: 'Account details returned successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserTransactions(@Param('id') userId: string) {
    return this.adminService.getUserAccountDetails(userId);
  }

  @Get('reports/usage')
  @ApiOperation({ summary: 'Get debit usage grouped by user' })
  @ApiResponse({ status: 200, description: 'Usage returned successfully' })
  getUsage() {
    return this.adminService.getBalanceUsagePerUser();
  }
}
