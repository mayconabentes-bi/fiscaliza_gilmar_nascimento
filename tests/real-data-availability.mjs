// Clasificador puro: a indisponibilidade externa transitória não deve esconder erros de conteúdo.
export function isTransientExternalFailure(source) {
  if (source?.availability !== "unavailable") return false;
  const message = String(source?.error || "").toLowerCase();

  // PNCP multi-CNPJ: só flexibilizar quando TODOS os códigos HTTP encontrados
  // forem limites temporários/erros transitórios, nunca em respostas 4xx permanentes.
  if (source?.source === "pncp_manaus_cnpjs") {
    const codes = [...message.matchAll(/\bhttp\s+(\d{3})\b/g)].map((match) => Number(match[1]));
    if (codes.length && codes.every((code) => code === 429 || [500, 502, 503, 504].includes(code))) {
      return true;
    }
  }

  return [
    "operation was aborted", "timeout", "timed out", "econnreset",
    "fetch failed", "temporarily unavailable", "http 403",
    "just a moment", "cloudflare",
  ].some((pattern) => message.includes(pattern));
}
