import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubmitPaymentDto } from '../../presentation/dto/submit-payment.dto';
import { SubmitPaymentUseCase } from '../../application/use-cases/submit-payment.use-case';
import type { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';
import {
  ApiGetPaymentDocs,
  ApiGetPaymentEventsDocs,
  ApiSubmitPaymentDocs,
} from './payment.docs';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly submitPayment: SubmitPaymentUseCase,
    @Inject('PAYMENT_REPOSITORY_PORT')
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiSubmitPaymentDocs()
  submit(
    @Body() dto: SubmitPaymentDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.submitPayment.execute({ ...dto, idempotencyKey });
  }

  @Get(':id')
  @ApiGetPaymentDocs()
  async getPayment(@Param('id') id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return payment;
  }

  @Get(':id/events')
  @ApiGetPaymentEventsDocs()
  async getEvents(@Param('id') id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return this.paymentRepository.getEvents(id);
  }
}
