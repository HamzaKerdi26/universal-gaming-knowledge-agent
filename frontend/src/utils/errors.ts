import axios from "axios";
import type { ApiErrorResponse } from "../types";

// Normalizes any thrown error (Axios error with our backend's JSON error
// shape, network failure, or anything else) into a single readable string.
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorResponse | undefined;
    if (data?.error?.message) {
      if (data.error.details && data.error.details.length > 0) {
        const fieldMessages = data.error.details
          .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
          .join("; ");
        return `${data.error.message} (${fieldMessages})`;
      }
      return data.error.message;
    }
    if (err.response) {
      return `Request failed with status ${err.response.status}`;
    }
    if (err.request) {
      return "Could not reach the server. Is the backend running?";
    }
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "An unexpected error occurred.";
}
