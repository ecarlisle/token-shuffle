export type TokenShuffleErrorCode =
  | "invalid_authorization"
  | "invalid_request"
  | "overloaded"
  | "streaming_not_supported"
  | "upstream_unavailable";

export class TokenShuffleError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: TokenShuffleErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TokenShuffleError";
  }
}

export function errorEnvelope(error: TokenShuffleError): {
  error: { type: "token_shuffle_error"; code: TokenShuffleErrorCode; message: string };
} {
  return {
    error: {
      type: "token_shuffle_error",
      code: error.code,
      message: error.message,
    },
  };
}
