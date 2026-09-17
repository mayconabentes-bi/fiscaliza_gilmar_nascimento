export function privateRequest(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const upstream = init.signal;
  const onAbort = () => controller.abort();
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener("abort", onAbort, { once: true });
  }

  const promise = fetch(input, { ...init, credentials: init.credentials ?? "same-origin", signal: controller.signal })
    .finally(() => {
      window.clearTimeout(timeout);
      if (upstream) upstream.removeEventListener("abort", onAbort);
    });

  return { promise, abort: () => controller.abort() };
}
