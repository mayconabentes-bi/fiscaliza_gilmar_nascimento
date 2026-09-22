import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const policy = fs.readFileSync("src/server/adminAccessPolicy.ts", "utf8");
const access = fs.readFileSync("src/server/internalAccess.ts", "utf8");
const auth = fs.readFileSync("src/server/privateAdminAuth.ts", "utf8");
const fast = fs.readFileSync("src/server/productionFastAdminRoutes.ts", "utf8");
const routes = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260922190000_setores_papeis_equipe.sql", "utf8");

const SCOPE = "::uuid is null or d.categoria in (select sc.categoria from private.setor_categorias sc where sc.setor_id =";

// Política central: acesso total continua restrito a ADMIN/SUPER_ADMIN.
expect(policy.includes('["ADMIN", "SUPER_ADMIN"]'), "Acesso total deve continuar restrito a ADMIN e SUPER_ADMIN.");
expect(policy.includes('["COORDENADOR", "ATENDENTE"]'), "Equipe de setor deve ter perfis explícitos.");
expect(policy.includes("SECTOR_STAFF_ROUTES") && policy.includes("isSectorStaffRoute"), "Equipe de setor deve usar lista fechada de rotas.");
expect(policy.includes('throw new Error("ESCOPO_AUSENTE")'), "Rota sem escopo definido deve falhar fechado.");

// Middleware: revalida setor no banco a cada requisição e nega por padrão.
expect(access.includes("from private.admins a") && access.includes("private.setor_categorias"), "Middleware deve carregar setor e categorias do banco.");
expect(access.includes('"missing_sector"') && access.includes("Usuário sem setor ativo configurado."), "Equipe sem setor ativo deve ser recusada.");
expect(access.includes("isSectorStaffRoute(req.method, req.originalUrl)"), "Equipe de setor fora da lista de rotas deve ser recusada.");
expect(access.includes('escopo: { tipo: "TOTAL", setorId: null }'), "ADMIN deve receber escopo TOTAL explícito.");
expect(!access.includes("ADMIN_REVALIDATION_TTL_MS"), "Revogação não pode depender de cache temporal.");

// Login e sessão reconhecem os novos perfis, sempre normalizados.
expect(auth.includes("normalizeStaffProfile") && auth.includes("isStaffProfile"), "Login/sessão devem aceitar apenas perfis de equipe normalizados.");

// Toda rota de demanda liberada à equipe de setor aplica o filtro de setor.
expect(fast.includes("setorDoEscopo(req.user?.escopo)"), "Listagem (fast path) deve obter o escopo do usuário.");
expect(fast.split(SCOPE).length - 1 === 2, "Listagem e contagem (fast path) devem filtrar por setor.");
expect(routes.split("setorDoEscopo(req.user?.escopo)").length - 1 >= 4, "Lista legada, evidência, evidências e status devem obter o escopo.");
expect(routes.split(SCOPE).length - 1 >= 4, "Evidência, evidências (atual e legada) e status devem filtrar por setor.");
expect(routes.includes("for update of d"), "Alteração de status deve travar apenas a demanda dentro do escopo.");
expect(routes.includes("setor_id: setorId"), "Auditoria de status deve registrar o setor de quem alterou.");

// Banco: travas de papel e setor continuam na migration.
expect(migration.includes("admins_setor_obrigatorio_check"), "Banco deve exigir setor para COORDENADOR/ATENDENTE.");
expect(migration.includes("categoria text not null unique"), "Cada categoria deve pertencer a um único setor.");

console.log("Sector scope contract: ok");
