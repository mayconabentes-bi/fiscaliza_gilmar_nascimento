import assert from "node:assert/strict";

const expansion = await import("../dist-server/src/intelligence/expansionSources.js");
const sources = await import("../dist-server/src/intelligence/sources.js");
const cnesFull = await import("../dist-server/src/intelligence/cnesFull.js");
const fiscal = await import("../dist-server/src/intelligence/fiscalEngine.js");
const pncpManaus = await import("../dist-server/src/intelligence/pncpManaus.js");
const publicEntities = await import("../dist-server/src/intelligence/manausPublicEntities.js");

const MANAUS_IBGE = 1302603;
const STABLE_YEAR = 2025;
const CURRENT_YEAR = 2026;
const failures = [];
const warnings = [];

function ok(condition, message) {
  assert.ok(condition, message);
}

function finiteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function report(name, source, details = {}) {
  console.log(JSON.stringify({
    qa: name,
    availability: source?.availability,
    records: Array.isArray(source?.data) ? source.data.length : null,
    quality: source?.quality || null,
    fetchedAt: source?.provenance?.fetchedAt || null,
    referencePeriod: source?.provenance?.referencePeriod || null,
    sourceUrl: source?.provenance?.sourceUrl || null,
    error: source?.error || null,
    ...details,
  }));
}

async function retry(loader, attempts = 3) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await loader();
    if (result?.availability === "available" || result?.availability === "degraded") return result;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  return result;
}

async function section(name, fn) {
  try {
    await fn();
    console.log(`QA PASS: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`QA FAIL: ${name}: ${message}`);
  }
}

async function verifyIbge() {
  const source = await retry(() => expansion.loadIbgePopulation());
  report("IBGE population", source);
  if (isTransientExternalFailure(source)) {
    const warning = `IBGE temporariamente indisponível; QA de conteúdo real adiado: ${source.error || "sem detalhe"}`;
    warnings.push(warning);
    console.warn(`QA DEGRADED: IBGE: ${warning}`);
    return;
  }
  ok(source.availability === "available", `IBGE indisponível/degradado: ${source.error || "sem detalhe"}`);
  ok(source.data.length >= 1, "IBGE sem registro populacional de Manaus");
  const row = source.data[0];
  ok(Number(row.codIbge) === MANAUS_IBGE, `IBGE retornou código inesperado: ${row.codIbge}`);
  ok(normalize(row.municipio).includes("MANAUS"), `IBGE retornou município inesperado: ${row.municipio}`);
  ok(finiteNumber(row.populacao), "IBGE população não numérica");
  ok(Number(row.populacao) > 1_500_000 && Number(row.populacao) < 3_000_000, `IBGE população fora de faixa plausível: ${row.populacao}`);
  ok(String(row.periodo || "").length >= 4, "IBGE sem período de referência");
}

async function verifySiconfi() {
  const source = await retry(() => expansion.loadSiconfi(STABLE_YEAR));
  report("SICONFI DCA", source);
  ok(source.availability === "available", `SICONFI indisponível/degradado: ${source.error || "sem detalhe"}`);
  ok(source.data.length > 100, `SICONFI retornou poucos registros: ${source.data.length}`);
  const exercises = source.data.map((row) => Number(row?.an_exercicio ?? row?.exercicio)).filter(Number.isFinite);
  if (exercises.length) ok(exercises.every((year) => year === STABLE_YEAR), `SICONFI misturou exercícios: ${[...new Set(exercises)].join(",")}`);
  const enteIds = source.data.map((row) => Number(row?.id_ente ?? row?.cod_ibge ?? row?.co_ente)).filter(Number.isFinite);
  if (enteIds.length) ok(enteIds.every((id) => id === MANAUS_IBGE), `SICONFI retornou ente diferente de Manaus: ${[...new Set(enteIds)].slice(0, 5).join(",")}`);

  const engine = fiscal.buildFiscalEngine(source.data);
  ok(engine.stages.previsto === null, "DCA real não deve inferir valor previsto a partir de linha granular");

  const expected = {
    realizado: 12391175265.47,
    empenhado: 11170457274,
    liquidado: 11076800358.84,
    pago: 11026203470.31,
  };
  for (const [stage, expectedValue] of Object.entries(expected)) {
    const row = engine.stages[stage];
    ok(row && finiteNumber(row.value), `SICONFI sem total canônico para ${stage}`);
    ok(row.selection === "canonical", `SICONFI ${stage} não foi selecionado por regra canônica`);
    const tolerance = Math.max(0.01, Math.abs(expectedValue) * 0.0000001);
    ok(Math.abs(Number(row.value) - expectedValue) <= tolerance, `SICONFI ${stage} divergente: ${row.value} != ${expectedValue}`);
  }
  console.log(`SICONFI fiscal QA: realizado=${engine.stages.realizado.value} | empenhado=${engine.stages.empenhado.value} | liquidado=${engine.stages.liquidado.value} | pago=${engine.stages.pago.value} | previsto=indisponível no DCA`);
}

function isTransientExternalFailure(source) {
  const message = String(source?.error || "").toLowerCase();
  return source?.availability === "unavailable" && (
    message.includes("operation was aborted") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("temporarily unavailable") ||
    message.includes("http 403") ||
    message.includes("just a moment") ||
    message.includes("cloudflare")
  );
}

async function verifyPncp() {
  const registry = publicEntities.manausPublicEntities();
  ok(registry.length >= 3, `Cadastro PNCP de Manaus muito pequeno: ${registry.length}`);
  const source = await retry(() => pncpManaus.loadPncpManausContracts(CURRENT_YEAR), 2);
  report("PNCP Manaus multi-CNPJ", source, { registry: registry.map((item) => ({ sigla: item.sigla, cnpj: item.cnpj })) });

  // Disponibilidade de uma API pública externa não deve transformar indisponibilidade
  // transitória em regressão de código. O contrato de retry/deduplicação do PNCP é
  // validado separadamente em test:pncp-resilience. Erros não transitórios continuam
  // bloqueando este QA profundo.
  if (isTransientExternalFailure(source)) {
    const warning = `PNCP temporariamente indisponível; QA de conteúdo real adiado: ${source.error || "sem detalhe"}`;
    warnings.push(warning);
    console.warn(`QA DEGRADED: PNCP: ${warning}`);
    return;
  }

  ok(["available", "degraded"].includes(source.availability), `PNCP indisponível: ${source.error || "sem detalhe"}`);
  ok(source.data.length > 0, `PNCP não retornou contratos para nenhum CNPJ público verificado de Manaus em ${CURRENT_YEAR}`);
  ok(source.quality.total >= source.data.length, "PNCP quality.total menor que registros coletados");
  const withControl = source.data.filter((row) => row?.id || row?.numero);
  ok(withControl.length / source.data.length > 0.9, "PNCP: mais de 10% dos contratos sem identificador reconhecido");
  const covered = new Set(source.data.map((row) => row?.cadastroCnpj).filter(Boolean));
  ok(covered.size >= 1, "PNCP não preservou o CNPJ consultado nos registros normalizados");
  const values = source.data.map((row) => Number(row?.valorInicial)).filter(Number.isFinite);
  ok(values.length > 0, "PNCP não expôs nenhum valor contratual numérico nos registros reais");
  console.log(`PNCP coverage QA: ${[...covered].join(", ")} | contratos=${source.data.length}`);
}

async function verifyCnes() {
  const catalog = await retry(() => expansion.loadCnesDataSusCatalog());
  report("CNES catalog", catalog);
  ok(["available", "degraded"].includes(catalog.availability), `CNES catálogo não acessível sem credencial: ${catalog.error || "sem detalhe"}`);
  ok(catalog.data.length > 0, "CNES catálogo retornou zero estabelecimentos de Manaus");

  const full = await retry(() => cnesFull.loadCnesManausFull());
  report("CNES full", full);
  ok(["available", "degraded"].includes(full.availability), `CNES completo indisponível: ${full.error || "sem detalhe"}`);
  ok(full.data.length >= catalog.data.length, `CNES completo (${full.data.length}) menor que primeira página (${catalog.data.length})`);
  ok(full.data.length > 100, `CNES completo retornou volume baixo para Manaus: ${full.data.length}`);
  const withId = full.data.filter((row) => String(row?.cnes || "").trim());
  ok(withId.length / full.data.length > 0.95, "CNES: mais de 5% dos estabelecimentos sem código CNES");
  const uniqueIds = new Set(withId.map((row) => String(row.cnes)));
  ok(uniqueIds.size / withId.length > 0.98, "CNES: duplicação excessiva de códigos CNES durante paginação");
  const withLocation = full.data.filter((row) => row?.bairro || (finiteNumber(row?.latitude) && finiteNumber(row?.longitude)));
  ok(withLocation.length / full.data.length > 0.7, `CNES: cobertura territorial insuficiente ${(withLocation.length / full.data.length * 100).toFixed(1)}%`);
}

async function verifyGeoManaus() {
  const [neighborhoods, works, health, schools] = await Promise.all([
    retry(() => sources.loadNeighborhoods()),
    retry(() => sources.loadMunicipalWorks()),
    retry(() => sources.loadHealthUnits()),
    retry(() => sources.loadSchools()),
  ]);
  for (const [name, source, min] of [
    ["GeoManaus bairros", neighborhoods, 40],
    ["SEMINF obras", works, 10],
    ["GeoManaus saúde", health, 10],
    ["GeoManaus escolas", schools, 50],
  ]) {
    report(name, source);
    ok(["available", "degraded"].includes(source.availability), `${name} indisponível: ${source.error || "sem detalhe"}`);
    ok(source.data.length >= min, `${name} abaixo do piso de sanidade: ${source.data.length} < ${min}`);
  }
  ok(neighborhoods.data.length < 100, `GeoManaus bairros retornou quantidade anômala: ${neighborhoods.data.length}`);
}

async function verifyObrasGov() {
  const source = await retry(() => sources.loadObrasGov());
  report("ObrasGov projects", source);
  ok(["available", "degraded"].includes(source.availability), `ObrasGov indisponível: ${source.error || "sem detalhe"}`);
  ok(source.data.length > 500, `ObrasGov retornou poucos projetos associados a Manaus: ${source.data.length}`);
  const withId = source.data.filter((row) => row?.id);
  ok(withId.length / source.data.length > 0.98, "ObrasGov: mais de 2% dos projetos sem ID normalizado");
  const withStatus = source.data.filter((row) => String(row?.situacao || "").trim());
  ok(withStatus.length / source.data.length > 0.5, "ObrasGov: maioria dos projetos sem situação");
}

async function verifySapl() {
  const source = await retry(() => sources.loadSapl(STABLE_YEAR));
  report("CMM SAPL", source);
  if (isTransientExternalFailure(source)) {
    const warning = `SAPL temporariamente indisponível; QA de conteúdo real adiado: ${source.error || "sem detalhe"}`;
    warnings.push(warning);
    console.warn(`QA DEGRADED: SAPL: ${warning}`);
    return;
  }
  ok(["available", "degraded"].includes(source.availability), `SAPL indisponível: ${source.error || "sem detalhe"}`);
  ok(source.data.length > 0, `SAPL retornou zero matérias para ${STABLE_YEAR}`);
}

for (const [name, fn] of [
  ["IBGE", verifyIbge],
  ["SICONFI", verifySiconfi],
  ["PNCP", verifyPncp],
  ["CNES", verifyCnes],
  ["GeoManaus", verifyGeoManaus],
  ["ObrasGov", verifyObrasGov],
  ["SAPL", verifySapl],
]) await section(name, fn);

if (failures.length) {
  throw new Error(`Deep real-data QA encontrou ${failures.length} falha(s): ${failures.join(" || ")}`);
}

if (warnings.length) console.warn(`Deep real-data QA concluído com ${warnings.length} aviso(s) de disponibilidade externa: ${warnings.join(" || ")}`);
console.log("Deep real-data QA OK: fontes públicas reais, identidade Manaus, volumes, paginação, campos críticos e normalização validados quando disponíveis.");
