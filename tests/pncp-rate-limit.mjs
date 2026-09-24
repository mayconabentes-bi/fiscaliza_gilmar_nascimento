import assert from "node:assert/strict";

process.env.MANAUS_INSTITUTIONS_JSON = JSON.stringify([
  { key: "a", nome: "Órgão A", sigla: "A", cnpj: "11111111000111", tipo: "secretaria", ativo: true },
  { key: "b", nome: "Órgão B", sigla: "B", cnpj: "22222222000122", tipo: "autarquia", ativo: true },
]);
process.env.PNCP_RETRY_ATTEMPTS = "2";
process.env.PNCP_MAX_PAGES_PER_ENTITY = "1";
process.env.PNCP_PAGE_SIZE = "10";
process.env.PNCP_REQUEST_GAP_MS = "0";
process.env.PNCP_TIMEOUT_MS = "5000";

const originalFetch = globalThis.fetch;
const { loadPncpManausContracts } = await import("../dist-server/src/intelligence/pncpManaus.js");

function contract(cnpj) {
  return {
    numeroControlePNCP: "CTRL-" + cnpj,
    numeroContratoEmpenho: "001/2026",
    objetoContrato: "Contrato de teste",
    valorInicial: 1234,
    dataAssinatura: "2026-01-10",
  };
}
function okResponse(cnpj) {
  return Response.json({ data: [contract(cnpj)], totalRegistros: 1, totalPaginas: 1 });
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const attempts = new Map();
  let active = 0;
  let peak = 0;
  globalThis.fetch = async (input) => {
    const cnpj = new URL(String(input)).searchParams.get("cnpjOrgao");
    const count = (attempts.get(cnpj) || 0) + 1;
    attempts.set(cnpj, count);
    active += 1;
    peak = Math.max(peak, active);
    await sleep(5);
    active -= 1;
    if (cnpj === "11111111000111" && count === 1) {
      return new Response("Limite excedido", { status: 429, headers: { "retry-after": "0" } });
    }
    return okResponse(cnpj);
  };
  const recovered = await loadPncpManausContracts(2026);
  assert.equal(attempts.get("11111111000111"), 2, "429 deve gerar retry controlado");
  assert.equal(attempts.get("22222222000122"), 1);
  assert.equal(peak, 1, "órgãos não devem consultar o PNCP simultaneamente");
  assert.equal(recovered.availability, "available");
  assert.equal(recovered.data.length, 2);

  attempts.clear();
  globalThis.fetch = async (input) => {
    const cnpj = new URL(String(input)).searchParams.get("cnpjOrgao");
    attempts.set(cnpj, (attempts.get(cnpj) || 0) + 1);
    return cnpj === "11111111000111"
      ? new Response("Parâmetro incorreto", { status: 400 })
      : okResponse(cnpj);
  };
  const permanent = await loadPncpManausContracts(2026);
  assert.equal(attempts.get("11111111000111"), 1, "4xx permanente não pode repetir");
  assert.equal(permanent.availability, "degraded");
  assert.equal(permanent.data.length, 1);
  assert.match(permanent.error || "", /HTTP 400/);

  attempts.clear();
  globalThis.fetch = async (input) => {
    const cnpj = new URL(String(input)).searchParams.get("cnpjOrgao");
    attempts.set(cnpj, (attempts.get(cnpj) || 0) + 1);
    return new Response("Limite excedido", { status: 429, headers: { "retry-after": "300" } });
  };
  const deferred = await loadPncpManausContracts(2026);
  assert.equal(deferred.availability, "unavailable");
  assert.equal(attempts.get("11111111000111"), 1, "Retry-After longo não deve provocar retry antecipado");
  assert.equal(attempts.get("22222222000122"), 1);
  assert.match(deferred.error || "", /HTTP 429: Retry-After/);
  console.log("PNCP rate-limit: retry 429, serialização, 400 sem retry e Retry-After longo validados.");
} finally {
  globalThis.fetch = originalFetch;
}
