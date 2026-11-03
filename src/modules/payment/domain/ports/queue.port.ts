export interface QueuePort {
  publishPaymentJob(payload: {
    paymentRequestId: string;
    userId: string;
    amount: string;
    reference: string;
  }): Promise<void>;
}
