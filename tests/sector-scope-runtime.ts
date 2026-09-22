import {
  isAllowedAdminProfile,
  isSectorStaffRoute,
  isStaffProfile,
  normalizeStaffProfile,
  setorDoEscopo,
} from "../src/server/adminAccessPolicy.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// Perfis
expect(isAllowedAdminProfile("ADMIN") && isAllowedAdminProfile("SUPER_ADMIN"), "ADMIN/SUPER_ADMIN têm acesso total.");
expect(!isAllowedAdminProfile("COORDENADOR") && !isAllowedAdminProfile("ATENDENTE"), "Equipe de setor não tem acesso total.");
for (const perfil of ["ADMIN", "SUPER_ADMIN", "COORDENADOR", "ATENDENTE"]) {
  expect(isStaffProfile(perfil), `${perfil} deve ser perfil de equipe válido.`);
}
for (const invalido of ["", "admin", "OPERADOR", "atendente", null, undefined]) {
  expect(!isStaffProfile(invalido) && normalizeStaffProfile(invalido) === null, `Perfil inválido recusado: ${String(invalido)}`);
}

// Rotas liberadas à equipe de setor (lista fechada)
const liberadas: Array<[string, string]> = [
  ["GET", "/api/admin/demandas"],
  ["GET", "/api/admin/demandas?status=RECEBIDA&categoria=SAUDE"],
  ["GET", "/api/admin/demandas/6f1c/evidencia"],
  ["GET", "/api/admin/demandas/6f1c/evidencias"],
  ["PATCH", "/api/admin/demandas/6f1c/status"],
];
for (const [method, url] of liberadas) {
  expect(isSectorStaffRoute(method, url), `Equipe de setor deve acessar ${method} ${url}.`);
}

// Tudo o mais continua exclusivo de ADMIN
const bloqueadas: Array<[string, string]> = [
  ["DELETE", "/api/admin/demandas/6f1c"],
  ["PATCH", "/api/admin/demandas/6f1c/categoria"],
  ["POST", "/api/admin/demandas/6f1c/status"],
  ["HEAD", "/api/admin/demandas"],
  ["GET", "/api/admin/audit"],
  ["GET", "/api/admin/auditoria/logs"],
  ["GET", "/api/admin/evidencias/pendentes"],
  ["POST", "/api/admin/evidencias/6f1c/decisao"],
  ["POST", "/api/admin/compliance/retention-run"],
  ["GET", "/api/admin/strategy/2028"],
  ["GET", "/api/admin/qa/health"],
  ["GET", "/api/demandas/metricas"],
  ["POST", "/api/relatorios/gerar"],
  ["GET", "/api/radar/manaus/resumo"],
  ["GET", "/api/intelligence/insights"],
  ["GET", "/api/admin/demandas/6f1c/status/extra"],
  ["GET", "/api/admin/demandasX"],
];
for (const [method, url] of bloqueadas) {
  expect(!isSectorStaffRoute(method, url), `Equipe de setor NÃO pode acessar ${method} ${url}.`);
}

// Escopo
expect(setorDoEscopo({ tipo: "TOTAL", setorId: null }) === null, "ADMIN não filtra por setor.");
expect(setorDoEscopo({ tipo: "SETOR", setorId: "setor-saude", categorias: ["SAUDE"] }) === "setor-saude", "Equipe filtra pelo próprio setor.");
let falhouFechado = false;
try { setorDoEscopo(undefined); } catch { falhouFechado = true; }
expect(falhouFechado, "Sem escopo definido, a rota deve falhar fechado.");

console.log("Sector scope runtime: ok");
