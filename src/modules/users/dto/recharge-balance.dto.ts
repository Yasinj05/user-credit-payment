import { Type } from 'class-transformer';
import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RechargeBalanceDto {
  @ApiProperty({
    example: 100,
    description: 'Amount to add to the user balance',
    minimum: 0.01,
    type: Number,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;
}
