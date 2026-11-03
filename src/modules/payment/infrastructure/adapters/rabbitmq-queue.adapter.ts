import { Injectable, OnModuleDestroy } from '@nestjs/common';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { QueuePort } from '../../domain/ports/queue.port';

const PAYMENT_QUEUE = 'payment_process_queue';

@Injectable()
export class RabbitMqQueueAdapter implements QueuePort, OnModuleDestroy {
  private connection?: ChannelModel;
  private channel?: Channel;

  async publishPaymentJob(payload: {
    paymentRequestId: string;
    userId: string;
    amount: string;
    reference: string;
  }): Promise<void> {
    const channel = await this.getChannel();
    channel.sendToQueue(PAYMENT_QUEUE, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      deliveryMode: 2,
    });
  }

  async consumePaymentJobs(
    handler: (payload: { paymentRequestId: string }) => Promise<void>,
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.consume(PAYMENT_QUEUE, (message) => {
      void this.handleMessage(channel, message, handler);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    this.connection = await amqp.connect(process.env.RABBITMQ_URL as string);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(PAYMENT_QUEUE, { durable: true });

    return this.channel;
  }

  private async handleMessage(
    channel: Channel,
    message: ConsumeMessage | null,
    handler: (payload: { paymentRequestId: string }) => Promise<void>,
  ): Promise<void> {
    if (!message) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as {
        paymentRequestId: string;
      };
      await handler(payload);
      channel.ack(message);
    } catch (error) {
      channel.nack(message, false, false);
      console.error('Payment job processing failed', error);
    }
  }
}
