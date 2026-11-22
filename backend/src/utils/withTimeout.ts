export class TimeoutError extends Error {}

// Wraps a promise so it rejects with TimeoutError if it hasn't settled
// within `ms`. Used by external API calls (Gemini generation, Gemini
// embeddings) that don't enforce their own timeout, so a hung request
// can't hang the whole HTTP request indefinitely.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return withAbortableTimeout(() => promise, ms);
}

export function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new TimeoutError("Request timed out"));
    }, ms);

    let promise: Promise<T>;
    try {
      promise = operation(controller.signal);
    } catch (error) {
      settled = true;
      clearTimeout(timer);
      reject(error);
      return;
    }

    promise.then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
