const allowed = /^[a-z0-9_-]{1,64}$/i;

export type PulsoAttribution = { src?: string; acao?: string };

export function getPulsoAttribution(search = window.location.search): PulsoAttribution {
  const params = new URLSearchParams(search);
  const rawSrc = params.get('src') || params.get('origem') || '';
  const rawAcao = params.get('acao') || '';
  const src = allowed.test(rawSrc) ? rawSrc.toLowerCase() : undefined;
  const acao = allowed.test(rawAcao) ? rawAcao.toLowerCase() : undefined;
  return { src, acao };
}

export function withPulsoAttribution(path: string, attribution = getPulsoAttribution()) {
  const params = new URLSearchParams();
  if (attribution.src) params.set('src', attribution.src);
  if (attribution.acao) params.set('acao', attribution.acao);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function trackPulsoEvent(event: string, attribution = getPulsoAttribution()) {
  const body = JSON.stringify({ event, ...attribution });
  fetch('/api/mobile-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
