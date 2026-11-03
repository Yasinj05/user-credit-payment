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
import {
  ApiAcceptedResponse,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SubmitPaymentDto } from '../../presentation/dto/submit-payment.dto';
import { SubmitPaymentUseCase } from '../../application/use-cases/submit-payment.use-case';
import type { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';

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
  @ApiOperation({ summary: 'Submit a payment request' })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: 'Optional key to safely retry the same request',
  })
  @ApiAcceptedResponse({ description: 'Payment queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  submit(
    @Body() dto: SubmitPaymentDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.submitPayment.execute({ ...dto, idempotencyKey });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment request details' })
  @ApiResponse({ status: 200, description: 'Payment returned successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(@Param('id') id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return payment;
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get payment lifecycle events' })
  @ApiResponse({ status: 200, description: 'Events returned chronologically' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getEvents(@Param('id') id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return this.paymentRepository.getEvents(id);
  }
}
