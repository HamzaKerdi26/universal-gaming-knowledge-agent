import { TimeoutError, withAbortableTimeout } from "../src/utils/withTimeout";

describe("withAbortableTimeout", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("aborts signal-aware work when the timeout expires", async () => {
    jest.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const operation = jest.fn((signal: AbortSignal) => {
      receivedSignal = signal;
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    });

    const result = withAbortableTimeout(operation, 100);
    const rejection = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await jest.advanceTimersByTimeAsync(100);
    await rejection;

    expect(receivedSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears its timer when work completes successfully", async () => {
    jest.useFakeTimers();

    await expect(withAbortableTimeout(() => Promise.resolve("done"), 100)).resolves.toBe("done");

    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves an immediate failure and clears its timer", async () => {
    jest.useFakeTimers();
    const failure = new Error("provider rejected");

    await expect(withAbortableTimeout(() => Promise.reject(failure), 100)).rejects.toBe(failure);

    expect(jest.getTimerCount()).toBe(0);
  });
});