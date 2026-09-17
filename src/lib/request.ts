export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let upstreamAbort: (() => void) | null = null;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else {
      upstreamAbort = () => controller.abort();
      upstreamSignal.addEventListener("abort", upstreamAbort, { once: true });
    }
  }

  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    if (upstreamSignal && upstreamAbort) upstreamSignal.removeEventListener("abort", upstreamAbort);
  }
}
