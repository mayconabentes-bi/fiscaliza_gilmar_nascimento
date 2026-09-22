import { canManageMember, generateTemporaryPassword, isUuid, validateNewMember } from "../src/server/teamPolicy.js";
import { isSectorStaffRoute } from "../src/server/adminAccessPolicy.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const SETOR = "0b6f5c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b";

// Quem pode gerenciar quem
const admin = { actorId: "a1", actorPerfil: "ADMIN" };
const superAdmin = { actorId: "s1", actorPerfil: "SUPER_ADMIN" };

expect(canManageMember({ ...admin, perfilDesejado: "ATENDENTE" }).ok, "ADMIN cria Atendente.");
expect(canManageMember({ ...admin, perfilDesejado: "COORDENADOR" }).ok, "ADMIN cria Coordenador.");
expect(!canManageMember({ ...admin, perfilDesejado: "ADMIN" }).ok, "ADMIN não cria outro ADMIN.");
expect(!canManageMember({ ...admin, perfilDesejado: "SUPER_ADMIN" }).ok, "ADMIN não cria SUPER_ADMIN.");
expect(!canManageMember({ ...admin, targetId: "x", targetPerfilAtual: "ATENDENTE", perfilDesejado: "ADMIN" }).ok, "ADMIN não promove Atendente a ADMIN.");
expect(!canManageMember({ ...admin, targetId: "x", targetPerfilAtual: "SUPER_ADMIN", perfilDesejado: "SUPER_ADMIN" }).ok, "ADMIN não altera SUPER_ADMIN.");
expect(!canManageMember({ ...admin, targetId: "a1", targetPerfilAtual: "ADMIN" }).ok, "Ninguém altera a própria conta.");
expect(canManageMember({ ...superAdmin, perfilDesejado: "ADMIN" }).ok, "SUPER_ADMIN cria ADMIN.");
expect(canManageMember({ ...superAdmin, targetId: "a1", targetPerfilAtual: "ADMIN", perfilDesejado: "ATENDENTE" }).ok, "SUPER_ADMIN rebaixa ADMIN.");
expect(!canManageMember({ ...superAdmin, targetId: "s1", targetPerfilAtual: "SUPER_ADMIN", perfilDesejado: "ATENDENTE" }).ok, "SUPER_ADMIN não rebaixa a si mesmo.");
for (const perfil of ["COORDENADOR", "ATENDENTE", "", "OPERADOR", undefined]) {
  expect(!canManageMember({ actorId: "z", actorPerfil: perfil, perfilDesejado: "ATENDENTE" }).ok, `Perfil ${String(perfil)} não gerencia equipe.`);
}

// Validação do cadastro
expect(validateNewMember({ nome: "Maria Silva", email: "Maria@Exemplo.org", perfil_acesso: "ATENDENTE", setor_id: SETOR }).ok, "Cadastro válido de Atendente.");
const normalizado = validateNewMember({ nome: "  Maria   Silva ", email: " MARIA@EXEMPLO.ORG ", perfil_acesso: "ADMIN", setor_id: SETOR });
expect(normalizado.ok && normalizado.value.email === "maria@exemplo.org" && normalizado.value.nome === "Maria Silva", "Nome e e-mail normalizados.");
expect(normalizado.ok && normalizado.value.setorId === null, "ADMIN não fica preso a setor.");
expect(!validateNewMember({ nome: "Maria Silva", email: "maria@exemplo.org", perfil_acesso: "ATENDENTE" }).ok, "Atendente sem setor é recusado.");
expect(!validateNewMember({ nome: "Maria Silva", email: "maria@exemplo.org", perfil_acesso: "ATENDENTE", setor_id: "'; drop table x;--" }).ok, "Setor inválido é recusado.");
expect(!validateNewMember({ nome: "Maria Silva", email: "sem-arroba", perfil_acesso: "ATENDENTE", setor_id: SETOR }).ok, "E-mail inválido é recusado.");
expect(!validateNewMember({ nome: "Ma", email: "m@x.org", perfil_acesso: "ATENDENTE", setor_id: SETOR }).ok, "Nome curto é recusado.");
expect(!validateNewMember({ nome: "Maria Silva", email: "m@x.org", perfil_acesso: "OPERADOR", setor_id: SETOR }).ok, "Papel inexistente é recusado.");

// Equipe de setor não alcança a gestão da equipe
for (const [method, url] of [["GET", "/api/admin/equipe"], ["POST", "/api/admin/equipe"], ["PATCH", "/api/admin/equipe/x"], ["POST", "/api/admin/equipe/x/senha-temporaria"]]) {
  expect(!isSectorStaffRoute(method, url), `Equipe de setor NÃO pode acessar ${method} ${url}.`);
}

// UUID
expect(isUuid(SETOR) && !isUuid("123") && !isUuid(null), "Validação de UUID.");

// Senha temporária
const senhas = new Set<string>();
for (let i = 0; i < 200; i++) {
  const senha = generateTemporaryPassword();
  expect(senha.length === 16, "Senha temporária tem 16 caracteres.");
  expect(/[A-Z]/.test(senha) && /[a-z]/.test(senha) && /[0-9]/.test(senha) && /[^A-Za-z0-9]/.test(senha), `Senha fraca gerada: ${senha}`);
  senhas.add(senha);
}
expect(senhas.size === 200, "Senhas temporárias não se repetem.");

console.log("Team management runtime: ok");
