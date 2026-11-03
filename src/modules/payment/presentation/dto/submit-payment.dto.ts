import { Type } from 'class-transformer';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitPaymentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: 75.5,
    description: 'Payment amount',
    minimum: 0.01,
    type: Number,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({
    example: 'ORDER-2026-0001',
    description: 'Unique payment reference',
  })
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @ApiPropertyOptional({
    example: 'Payment for order 0001',
    description: 'Optional payment description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
