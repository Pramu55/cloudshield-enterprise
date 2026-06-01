export class AwsConnectorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DISABLED"
      | "NOT_CONFIGURED"
      | "AUTH_FAILED"
      | "PERMISSION_DENIED"
      | "VALIDATION_FAILED"
  ) {
    super(message);
    this.name = "AwsConnectorError";
  }
}
