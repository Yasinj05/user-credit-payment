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
  ApiParam,
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
  @ApiAcceptedResponse({
    description: 'Payment queued successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        amount: { type: 'string', example: '75.50' },
        reference: { type: 'string', example: 'ORDER-2026-0001' },
        description: {
          type: 'string',
          nullable: true,
          example: 'Payment for order 0001',
        },
        status: {
          type: 'string',
          enum: [
            'PENDING',
            'QUEUED',
            'PROCESSING',
            'SUCCEEDED',
            'FAILED',
            'CANCELLED',
          ],
          example: 'QUEUED',
        },
        failureReason: { type: 'string', nullable: true, example: null },
        retryCount: { type: 'integer', example: 0 },
        idempotencyKey: {
          type: 'string',
          nullable: true,
          example: 'checkout-0001',
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
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
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        amount: { type: 'string', example: '75.50' },
        reference: { type: 'string', example: 'ORDER-2026-0001' },
        status: {
          type: 'string',
          enum: [
            'PENDING',
            'QUEUED',
            'PROCESSING',
            'SUCCEEDED',
            'FAILED',
            'CANCELLED',
          ],
        },
        failureReason: { type: 'string', nullable: true },
        retryCount: { type: 'integer', example: 0 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
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
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Events returned chronologically',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          paymentRequestId: { type: 'string', format: 'uuid' },
          event: { type: 'string', example: 'Queued' },
          metadata: { type: 'object', nullable: true, example: null },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getEvents(@Param('id') id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return this.paymentRepository.getEvents(id);
  }
}
