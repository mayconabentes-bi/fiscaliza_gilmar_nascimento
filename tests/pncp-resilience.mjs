import assert from "node:assert/strict";

process.env.MANAUS_INSTITUTIONS_JSON = JSON.stringify([
  { key: "orgao_a", nome: "Órgão A", sigla: "A", cnpj: "11111111000111", tipo: "secretaria", ativo: true },
  { key: "orgao_b", nome: "Órgão B", sigla: "B", cnpj: "22222222000122", tipo: "autarquia", ativo: true },
]);
process.env.PNCP_RETRY_ATTEMPTS = "2";
process.env.PNCP_MAX_PAGES_PER_ENTITY = "2";
process.env.PNCP_PAGE_SIZE = "10";
process.env.PNCP_TIMEOUT_MS = "5000";

const originalFetch = globalThis.fetch;
const attempts = new Map();

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const cnpj = url.searchParams.get("cnpjOrgao");
  const page = Number(url.searchParams.get("pagina") || 1);
  const key = `${cnpj}:${page}`;
  attempts.set(key, (attempts.get(key) || 0) + 1);

  // Simula JSON truncado na primeira tentativa do órgão A.
  if (cnpj === "11111111000111" && page === 1 && attempts.get(key) === 1) {
    return new Response('{"data":[', { status: 200, headers: { "content-type": "application/json" } });
  }

  const shared = {
    numeroControlePNCP: "PNCP-UNICO-1",
    numeroContratoEmpenho: "001/2026",
    objetoContrato: "Contrato compartilhado",
    valorInicial: 1000,
    dataAssinatura: "2026-01-10",
  };

  if (page > 1) return Response.json({ data: [], totalRegistros: 1, totalPaginas: 1 });
  return Response.json({ data: [shared], totalRegistros: 1, totalPaginas: 1 });
};

try {
  const { loadPncpManausContracts } = await import("../dist-server/src/intelligence/pncpManaus.js");
  const result = await loadPncpManausContracts(2026);

  assert.equal(attempts.get("11111111000111:1"), 2, "deve repetir após JSON inválido");
  assert.equal(result.data.length, 1, "deve deduplicar numeroControlePNCP repetido entre CNPJs");
  assert.equal(result.data[0].id, "PNCP-UNICO-1");
  assert.equal(result.availability, "available");
  assert.equal(result.quality.total, 1, "health deve contar contratos únicos, não soma bruta reportada");
  assert.equal(result.quality.classified, 1);
  assert.equal(result.quality.unclassified, 0);
  assert.equal(result.quality.coverage, 1, "cobertura deve refletir órgãos concluídos");
  assert.match(result.error || "", /1 contratos únicos para \d+ registros reportados\/somados pelas consultas\./);
  console.log("PNCP resilience: retry, deduplicação e contagem única validados.");
} finally {
  globalThis.fetch = originalFetch;
}
