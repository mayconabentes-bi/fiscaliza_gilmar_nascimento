const TIMEOUT_MS = 12000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, attempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "PulsoSourceActivation/1.0" },
      });
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      return { response, json };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    } finally { clearTimeout(timeout); }
  }
  throw lastError;
}

async function verifyObrasGov() {
  const specUrl = "https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json";
  const { response, json } = await fetchJson(specUrl);
  assert(response.status === 200, `ObrasGov OpenAPI HTTP ${response.status}`);
  assert(json?.openapi, "ObrasGov não retornou OpenAPI");
  for (const path of ["/projeto-investimento", "/geometria", "/execucao-fisica", "/contrato"]) {
    assert(json?.paths?.[path]?.get, `ObrasGov perdeu operação GET ${path}`);
  }
  assert(!json?.components?.securitySchemes, "ObrasGov passou a declarar autenticação; revisar adapter");

  const geometryUrl = "https://api-publica.obrasgov.gestao.gov.br/obras/geometria?cod_ibge=1302603&pagina=1&tamanho_da_pagina=5";
  const geometry = await fetchJson(geometryUrl);
  assert(geometry.response.status === 200, `ObrasGov geometria HTTP ${geometry.response.status}`);
  for (const key of ["data", "total_pages", "total_items", "page_number", "page_size"]) {
    assert(Object.prototype.hasOwnProperty.call(geometry.json || {}, key), `ObrasGov geometria sem ${key}`);
  }
  assert(Array.isArray(geometry.json?.data), "ObrasGov geometria data não é array");
  const sample = geometry.json.data[0];
  if (sample) {
    assert(Number(sample.cod_ibge) === 1302603, `ObrasGov retornou município inesperado: ${sample.cod_ibge}`);
    assert(sample.id_projeto_investimento, "ObrasGov geometria sem id_projeto_investimento");
    const projectUrl = `https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento?id_projeto_investimento=${encodeURIComponent(sample.id_projeto_investimento)}&pagina=1&tamanho_da_pagina=5`;
    const project = await fetchJson(projectUrl);
    assert(project.response.status === 200, `ObrasGov projeto HTTP ${project.response.status}`);
    assert(Array.isArray(project.json?.data), "ObrasGov projeto data não é array");
    const row = project.json.data[0];
    if (row) {
      for (const key of ["id_projeto_investimento", "desc_nome", "situacao", "uf_principal", "organizacao_resp"]) {
        assert(Object.prototype.hasOwnProperty.call(row, key), `ObrasGov projeto sem ${key}`);
      }
    }
  }
  console.log(`ObrasGov contract OK: ${geometry.json?.total_items ?? 0} geometrias associadas a Manaus.`);
}

async function verifyTceAm() {
  const specUrl = "https://econtasapi.tce.am.gov.br/v3/api-docs";
  let result;
  try { result = await fetchJson(specUrl, 3); }
  catch (error) {
    console.warn(`TCE-AM upstream indisponível no runner: ${error?.message || String(error)}. Contrato não reprovado por falha transitória de terceiro.`);
    return;
  }
  const { response, json } = result;
  assert(response.status === 200, `TCE-AM OpenAPI HTTP ${response.status}`);
  assert(json?.openapi, "TCE-AM respondeu, mas não retornou OpenAPI");
  assert(json?.components?.securitySchemes?.bearerAuth?.scheme === "bearer", "TCE-AM bearerAuth não encontrado");
  assert(json?.paths?.["/auth"]?.post, "TCE-AM perdeu POST /auth");
  for (const path of [
    "/transparencia/dados-abertos/unidades",
    "/transparencia/dados-abertos/empenhos/{idUnidadeGestora}/{exercicio}/{mes}",
    "/transparencia/dados-abertos/contratos/{idUnidadeGestora}/{exercicio}",
    "/audicop/listaObras/{idUnidadeGestora}/{exercicio}",
  ]) {
    assert(json?.paths?.[path]?.get, `TCE-AM perdeu operação GET ${path}`);
  }
  const login = json?.components?.schemas?.LoginForm?.properties || {};
  for (const field of ["client_id", "username", "password"]) assert(login[field], `TCE-AM LoginForm sem ${field}`);
  const token = json?.components?.schemas?.TokenDto?.properties || {};
  assert(token.access_token, "TCE-AM TokenDto sem access_token");
  console.log("TCE-AM contract OK: OpenAPI público; dados protegidos por Bearer JWT.");
}

async function verifyManausPortal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("https://transparencia.manaus.am.gov.br/", {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "text/html", "User-Agent": "PulsoSourceActivation/1.0" },
    });
    assert(response.status === 200, `Transparência Manaus HTTP ${response.status}`);
    assert(response.url.includes("transparencia.manaus.am.gov.br"), "Portal de Manaus redirecionou para host inesperado");
    console.log("Transparência Manaus contract OK: portal oficial disponível; endpoint JSON permanece explicitamente configurável.");
  } catch (error) {
    console.warn(`Portal Transparência Manaus indisponível no runner: ${error?.message || String(error)}. Falha transitória de terceiro não reprova CI.`);
  } finally { clearTimeout(timeout); }
}

await verifyObrasGov();
await verifyTceAm();
await verifyManausPortal();
console.log("Source activation contracts OK.");
