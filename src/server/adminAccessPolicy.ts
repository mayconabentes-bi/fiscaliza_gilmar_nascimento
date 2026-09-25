/**
 * Perfis com acesso TOTAL ao núcleo privado (todas as rotas administrativas).
 */
export const ALLOWED_ADMIN_PROFILES = ["ADMIN", "SUPER_ADMIN"] as const;

/**
 * Perfis da equipe de setor (Fase 1). Só enxergam demandas das categorias do
 * próprio setor e só acessam as rotas listadas em SECTOR_STAFF_ROUTES.
 */
export const SECTOR_STAFF_PROFILES = ["COORDENADOR", "ATENDENTE"] as const;

export type AdminProfile = typeof ALLOWED_ADMIN_PROFILES[number];
export type SectorStaffProfile = typeof SECTOR_STAFF_PROFILES[number];
export type StaffProfile = AdminProfile | SectorStaffProfile;

/**
 * Escopo de dados do usuário autenticado.
 * TOTAL: vê todas as demandas. SETOR: só as categorias do próprio setor.
 */
export type EscopoAcesso =
  | { tipo: "TOTAL"; setorId: null }
  | { tipo: "SETOR"; setorId: string; categorias: string[] };

export function isAllowedAdminProfile(value: unknown): value is AdminProfile {
  return ALLOWED_ADMIN_PROFILES.includes(String(value || "") as AdminProfile);
}

export function normalizeAdminProfile(value: unknown): AdminProfile | null {
  const normalized = String(value || "");
  return isAllowedAdminProfile(normalized) ? normalized : null;
}

export function isSectorStaffProfile(value: unknown): value is SectorStaffProfile {
  return SECTOR_STAFF_PROFILES.includes(String(value || "") as SectorStaffProfile);
}

export function isStaffProfile(value: unknown): value is StaffProfile {
  return isAllowedAdminProfile(value) || isSectorStaffProfile(value);
}

export function normalizeStaffProfile(value: unknown): StaffProfile | null {
  const normalized = String(value || "");
  return isStaffProfile(normalized) ? normalized : null;
}

/**
 * Lista fechada (negar por padrão) do que a equipe de setor pode acessar.
 * Qualquer rota fora desta lista continua exclusiva de ADMIN/SUPER_ADMIN.
 */
const SECTOR_STAFF_ROUTES: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/admin\/field-registration\/tickets\/?$/ },
  { method: "GET", pattern: /^\/api\/admin\/demandas\/?$/ },
  { method: "GET", pattern: /^\/api\/admin\/demandas\/[^/]+\/evidencias?\/?$/ },
  { method: "PATCH", pattern: /^\/api\/admin\/demandas\/[^/]+\/status\/?$/ },
];

export function isSectorStaffRoute(method: unknown, originalUrl: unknown): boolean {
  const verb = String(method || "").toUpperCase();
  const path = String(originalUrl || "").split("?")[0];
  return SECTOR_STAFF_ROUTES.some((route) => route.method === verb && route.pattern.test(path));
}

/**
 * Setor usado para filtrar consultas: null = acesso total.
 * Falha fechado: sem escopo definido pelo middleware, a rota não executa.
 */
export function setorDoEscopo(escopo: EscopoAcesso | undefined): string | null {
  if (!escopo) throw new Error("ESCOPO_AUSENTE");
  return escopo.tipo === "TOTAL" ? null : escopo.setorId;
}
