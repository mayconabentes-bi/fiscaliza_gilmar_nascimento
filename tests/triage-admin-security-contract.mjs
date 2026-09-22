import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const access = fs.readFileSync("src/server/internalAccess.ts", "utf8");
const auth = fs.readFileSync("src/server/privateAdminAuth.ts", "utf8");
const app = fs.readFileSync("src/server/app.ts", "utf8");
const policy = fs.readFileSync("src/server/adminAccessPolicy.ts", "utf8");
const goLive = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");

expect(policy.includes('["ADMIN", "SUPER_ADMIN"]'), "Política deve permitir somente ADMIN e SUPER_ADMIN.");
expect(access.includes('from "./adminAccessPolicy.js"'), "Middleware deve usar política administrativa central.");
expect(!access.includes("ADMIN_REVALIDATION_TTL_MS"), "Revogação administrativa não pode depender de cache temporal.");
expect(access.includes("from private.admins"), "Toda requisição admin em produção deve revalidar private.admins.");
expect(access.includes('user.type !== "admin"'), "Token cidadão ou outro tipo deve ser recusado.");
expect(access.includes('user.status !== "ativo"'), "Token administrativo inativo deve ser recusado.");
expect(access.includes("jwt.verify"), "JWT deve ser verificado criptograficamente.");

expect(auth.includes("ADMIN_EMAIL_MAX_LENGTH = 254"), "Login deve limitar tamanho do e-mail.");
expect(auth.includes("ADMIN_PASSWORD_MAX_LENGTH = 256"), "Login deve limitar tamanho da senha.");
expect(auth.includes("DUMMY_ADMIN_PASSWORD_HASH"), "Login deve reduzir enumeração temporal para conta ausente/inativa.");
expect(auth.includes("normalizeStaffProfile"), "Login deve falhar fechado para perfil administrativo inválido.");
expect(auth.includes("select id, nome, ativo, perfil_acesso") && auth.includes("from private.admins"), "Sessão visual deve revalidar admin no banco.");
expect(auth.includes('sameSite: "strict"') && auth.includes("httpOnly: true"), "Cookie admin deve manter HttpOnly + SameSite Strict.");

expect(app.includes('app.use("/api/auth/admin/login", limiter(15 * 60 * 1000, 10))'), "Login admin deve ter rate limit dedicado.");
for (const prefix of ["/api/admin", "/api/demandas/metricas", "/api/relatorios", "/api/radar/manaus"]) {
  expect(app.includes(`app.use("${prefix}", requireAdmin)`), `${prefix} deve permanecer atrás do middleware admin.`);
}
expect(goLive.includes('["POST", "PUT", "PATCH", "DELETE"]') && goLive.includes("Origem não autorizada para operação mutável"), "Operações mutáveis devem manter proteção de origem/CSRF.");

console.log("T1 admin security contract: ok");
