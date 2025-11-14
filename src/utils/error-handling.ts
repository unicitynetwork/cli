/**
 * Error Handling Utilities
 *
 * Provides utility functions for extracting detailed error information
 * from complex error chains, especially network errors.
 */

/**
 * Extract detailed error message from network errors
 * Traverses error chain to find root cause with error codes
 *
 * Network error codes include:
 * - ECONNREFUSED: Connection refused
 * - ENOTFOUND: DNS resolution failed
 * - ETIMEDOUT: Connection timed out
 * - ECONNRESET: Connection reset
 * - ENETUNREACH: Network unreachable
 *
 * @param error - The error object to extract message from
 * @returns Detailed error message with error code if available
 */
export function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message;
    let cause: any = (error as any).cause;

    // Traverse error chain to find root cause
    while (cause) {
      if (cause.code) {
        // Network error codes: ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
        const codeMessage = cause.message || message;
        return `${cause.code}: ${codeMessage}`;
      }
      if (cause.message) {
        message = cause.message;
      }
      cause = cause.cause;
    }

    return message;
  }
  return String(error);
}
