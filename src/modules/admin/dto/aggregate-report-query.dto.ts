import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportPeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class AggregateReportQueryDto {
  @ApiPropertyOptional({
    enum: ReportPeriod,
    enumName: 'ReportPeriod',
    default: ReportPeriod.DAILY,
    example: ReportPeriod.MONTHLY,
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period: ReportPeriod = ReportPeriod.DAILY;
}
