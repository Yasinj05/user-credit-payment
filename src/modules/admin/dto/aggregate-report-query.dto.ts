import { IsEnum, IsOptional } from 'class-validator';

export enum ReportPeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class AggregateReportQueryDto {
  @IsOptional()
  @IsEnum(ReportPeriod)
  period: ReportPeriod = ReportPeriod.DAILY;
}
