/**
 * Error codes are the ones enumerated in spec section 33 — this is
 * the literal contract the Android developer codes against. Don't
 * invent new codes without adding them here and in the spec doc.
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "AGREEMENT_NOT_FOUND"
  | "NOT_FOUND"
  | "INVALID_TRANSCRIPT"
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "VALIDATION_ERROR"
  | "STATE_CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

/**
 * Every error response on the wire is { error: { code, message,
 * requestId } } per spec section 33. Throw ApiError from anywhere in
 * a handler or service and errorHandler will shape it correctly.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  static unauthenticated(message = "Missing or invalid credentials") {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "Not allowed to access this resource") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static agreementNotFound(message = "Agreement not found") {
    return new ApiError(404, "AGREEMENT_NOT_FOUND", message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static invalidTranscript(message: string) {
    return new ApiError(400, "INVALID_TRANSCRIPT", message);
  }
  static aiTimeout(message = "We couldn't generate the contract right now.") {
    return new ApiError(504, "AI_TIMEOUT", message);
  }
  static aiInvalidOutput(message = "The contract could not be generated. Please try again.") {
    return new ApiError(502, "AI_INVALID_OUTPUT", message);
  }
  static validation(message: string) {
    return new ApiError(400, "VALIDATION_ERROR", message);
  }
  static stateConflict(message: string) {
    return new ApiError(409, "STATE_CONFLICT", message);
  }
  static rateLimited(message = "Rate limit exceeded") {
    return new ApiError(429, "RATE_LIMITED", message);
  }
  static internal(message = "Internal server error") {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }
}
