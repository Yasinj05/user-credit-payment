import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  ApiAdminAggregatesDocs,
  ApiAdminUsageDocs,
  ApiAdminUserTransactionsDocs,
  ApiAdminUsersDocs,
} from './admin.docs';
import { AggregateReportQueryDto } from './dto/aggregate-report-query.dto';

@ApiTags('Admin Reports')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports/aggregates')
  @ApiAdminAggregatesDocs()
  getAggregates(@Query() query: AggregateReportQueryDto) {
    return this.adminService.getAggregates(query.period);
  }

  @Get('users')
  @ApiAdminUsersDocs()
  listUsers() {
    return this.adminService.listUsersWithBalances();
  }

  @Get('users/:id/transactions')
  @ApiAdminUserTransactionsDocs()
  getUserTransactions(@Param('id') userId: string) {
    return this.adminService.getUserAccountDetails(userId);
  }

  @Get('reports/usage')
  @ApiAdminUsageDocs()
  getUsage() {
    return this.adminService.getBalanceUsagePerUser();
  }
}
