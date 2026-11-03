import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportPeriod } from './dto/aggregate-report-query.dto';

type AggregateReportRow = {
  period: Date;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  getAggregates(period: ReportPeriod): Promise<AggregateReportRow[]> {
    const dateTruncField =
      {
        [ReportPeriod.DAILY]: 'day',
        [ReportPeriod.MONTHLY]: 'month',
        [ReportPeriod.YEARLY]: 'year',
      }[period] || 'day';

    return this.prisma.$queryRaw<AggregateReportRow[]>(Prisma.sql`
      SELECT
        date_trunc(${dateTruncField}, "createdAt") AS "period",
        COALESCE(SUM("amount") FILTER (WHERE "type"::text = 'DEBIT'), 0) AS "debitTotal",
        COALESCE(SUM("amount") FILTER (WHERE "type"::text = 'CREDIT'), 0) AS "creditTotal"
      FROM "Transaction"
      GROUP BY 1
      ORDER BY 1 ASC
    `);
  }

  listUsersWithBalances() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        balance: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUserAccountDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return user;
  }

  getBalanceUsagePerUser() {
    return this.prisma.transaction.groupBy({
      by: ['userId'],
      where: { type: TransactionType.DEBIT },
      _sum: { amount: true },
      orderBy: { userId: 'asc' },
    });
  }
}
