export class CAUninitializedError extends Error {
  readonly cause?: unknown;

  constructor(
    message: string = 'CAFileStore cannot read or generate a valid CA',
    cause?: unknown,
  ) {
    super(message);
    this.name = 'CAUninitializedError';
    this.cause = cause;
  }
}
