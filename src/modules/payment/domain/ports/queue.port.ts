export interface QueuePort {
  publishPaymentJob(payload: {
    paymentRequestId: string;
    userId: string;
    amount: string;
    reference: string;
  }): Promise<void>;
  consumePaymentJobs(
    handler: (payload: { paymentRequestId: string }) => Promise<void>,
  ): Promise<void>;
}
