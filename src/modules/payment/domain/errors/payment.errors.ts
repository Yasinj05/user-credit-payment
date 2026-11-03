export class InsufficientBalanceError extends Error {
  readonly isBusinessError = true;
  readonly isRetryable = false;

  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class TechnicalGlitchError extends Error {
  readonly isBusinessError = false;
  readonly isRetryable = true;

  constructor(message: string) {
    super(message);
    this.name = 'TechnicalGlitchError';
  }
}
