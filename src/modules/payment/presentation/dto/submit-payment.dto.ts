import { Type } from 'class-transformer';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class SubmitPaymentDto {
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
