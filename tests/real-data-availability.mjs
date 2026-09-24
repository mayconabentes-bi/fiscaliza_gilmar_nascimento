// Classificador puro: indisponibilidade externa não substitui verificação de conteúdo.
export function isTransientExternalFailure(source) {
  if (source?.availability !== "unavailable") return false;
  const message = String(source?.error || "").toLowerCase();

  if (source?.source === "pncp_manaus_cnpjs") {
    // Erros de múltiplos CNPJs devem ser avaliados individualmente. Respostas
    // 400/401/403/422 de validação NÃO podem ficar ocultas por outro erro 429.
    const issues = message.replace(/^falhas parciais:\s*/, "").split(/\s+\|\s+/);
    const transient = (issue) => {
      const codes = [...issue.matchAll(/\bhttp\s+(\d{3})\b/g)].map((match) => Number(match[1]));
      if (codes.length) {
        return codes.every((code) => [429, 500, 502, 503, 504].includes(code) ||
          // PNCP responde 422 também em erro SQL interno documentado nos logs.
          // Um 422 genérico continua bloqueando o gate.
          (code === 422 && /could not execute query;\s*sql/.test(issue)));
      }
      // Após retries, 200 com corpo vazio não comprova conteúdo real.
      return issue.includes("pncp respondeu com corpo vazio") ||
        ["operation was aborted", "timeout", "timed out", "econnreset",
          "fetch failed", "temporarily unavailable", "just a moment", "cloudflare"
        ].some((pattern) => issue.includes(pattern));
    };
    return issues.length > 0 && issues.every(transient);
  }

  return [
    "operation was aborted", "timeout", "timed out", "econnreset",
    "fetch failed", "temporarily unavailable", "http 403",
    "just a moment", "cloudflare",
  ].some((pattern) => message.includes(pattern));
}
