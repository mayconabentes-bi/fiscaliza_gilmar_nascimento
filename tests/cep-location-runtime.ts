import assert from "node:assert/strict";
import {
  CepLookupError,
  lookupCepWithProviders,
  type CepLookupPayload,
} from "../src/server/cepLookup.ts";

const CEP = "69058790";

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const viaPayload = {
  cep: "69058-790",
  logradouro: "Rua Visconde de Sinimbu",
  complemento: "",
  bairro: "Flores",
  localidade: "Manaus",
  uf: "AM",
  ibge: "1302603",
};

const brasilApiPayload = {
  cep: "69058790",
  state: "AM",
  city: "Manaus",
  neighborhood: "Flores",
  street: "Rua Visconde de Sinimbu",
  service: "open-cep",
  ibge: { city: "1302603", state: "13" },
};

async function expectLookupError(
  promise: Promise<CepLookupPayload>,
  code: CepLookupError["code"],
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof CepLookupError);
    assert.equal(error.code, code);
    return true;
  });
}

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return jsonResponse(viaPayload);
  }) as typeof fetch;

  const result = await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(result.municipio, "Manaus");
  assert.equal(result.codigo_ibge, "1302603");
  assert.equal(calls.length, 1, "BrasilAPI não deve ser chamada quando ViaCEP funciona");
  assert.equal(new URL(calls[0].url).hostname, "viacep.com.br");
  assert.equal(calls[0].init?.redirect, "error");
  assert.equal((calls[0].init?.headers as Record<string, string>).Accept, "application/json");
}

{
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return url.includes("viacep.com.br")
      ? jsonResponse({ error: "down" }, 503)
      : jsonResponse(brasilApiPayload);
  }) as typeof fetch;

  const result = await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(result.logradouro, "Rua Visconde de Sinimbu");
  assert.equal(result.bairro, "Flores");
  assert.deepEqual(calls.map((url) => new URL(url).hostname), [
    "viacep.com.br",
    "brasilapi.com.br",
  ]);
}

{
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("viacep.com.br")) throw new TypeError("fetch failed");
    return jsonResponse(brasilApiPayload);
  }) as typeof fetch;
  const result = await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(result.uf, "AM");
}

{
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return jsonResponse({ erro: true });
  }) as typeof fetch;
  await expectLookupError(
    lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 }),
    "not_found",
  );
  assert.equal(calls, 1, "CEP inexistente no ViaCEP não deve acionar fallback");
}

{
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return jsonResponse({ error: "bad request" }, 400);
  }) as typeof fetch;
  await expectLookupError(
    lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 }),
    "unavailable",
  );
  assert.equal(calls, 1, "HTTP inesperado não deve ser mascarado pelo fallback");
}

{
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("viacep.com.br")) {
      return jsonResponse({ ...viaPayload, cep: "01001-000" });
    }
    return jsonResponse(brasilApiPayload);
  }) as typeof fetch;
  const result = await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(result.cep, "69058-790", "CEP divergente deve ser descartado");
}

{
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("viacep.com.br")) {
      return jsonResponse({}, 200, { "content-length": String(70 * 1024) });
    }
    return jsonResponse(brasilApiPayload);
  }) as typeof fetch;
  const result = await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(result.municipio, "Manaus", "Resposta excessiva deve acionar fallback");
}

{
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    await new Promise<never>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    });
    throw new Error("unreachable");
  }) as typeof fetch;
  await expectLookupError(
    lookupCepWithProviders(CEP, {
      fetchImpl,
      timeoutMs: 80,
      primaryTimeoutMs: 20,
    }),
    "unavailable",
  );
}

{
  const original = process.env.VIACEP_API_BASE;
  process.env.VIACEP_API_BASE = "http://169.254.169.254/latest/meta-data";
  let requestedHost = "";
  const fetchImpl = (async (input: string | URL | Request) => {
    requestedHost = new URL(String(input)).hostname;
    return jsonResponse(viaPayload);
  }) as typeof fetch;
  await lookupCepWithProviders(CEP, { fetchImpl, timeoutMs: 500 });
  assert.equal(requestedHost, "viacep.com.br", "Base insegura deve ser ignorada");
  if (original === undefined) delete process.env.VIACEP_API_BASE;
  else process.env.VIACEP_API_BASE = original;
}

await expectLookupError(
  lookupCepWithProviders("69058", {
    fetchImpl: (async () => jsonResponse(viaPayload)) as typeof fetch,
  }),
  "invalid_request",
);

console.log("CEP provider runtime: ok — fallback, timeout, payload e SSRF validados.");
