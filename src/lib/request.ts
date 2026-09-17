export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let upstreamAbort: (() => void) | null = null;
  let timedOut = false;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else {
      upstreamAbort = () => controller.abort();
      upstreamSignal.addEventListener("abort", upstreamAbort, { once: true });
    }
  }

  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && !upstreamSignal?.aborted) {
      const timeoutError = new Error(`A solicitação excedeu o tempo limite de ${timeoutMs} ms.`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    if (upstreamSignal && upstreamAbort) upstreamSignal.removeEventListener("abort", upstreamAbort);
  }
}
