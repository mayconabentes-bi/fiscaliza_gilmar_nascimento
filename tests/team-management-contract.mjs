import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const routes = fs.readFileSync("src/server/teamManagementRoutes.ts", "utf8");
const policy = fs.readFileSync("src/server/adminAccessPolicy.ts", "utf8");
const app = fs.readFileSync("src/server/app.ts", "utf8");
const page = fs.readFileSync("src/pages/AdminEquipe.tsx", "utf8");
const shell = fs.readFileSync("src/App.tsx", "utf8");

// Perímetro: rotas da equipe ficam sob /api/admin e fora da lista de rotas de setor.
expect(/app\.(get|post|patch)\("\/api\/admin\/equipe/.test(routes), "Gestão da equipe deve ficar sob /api/admin.");
expect(!policy.includes("\\/equipe"), "Lista de rotas de setor não pode incluir a gestão da equipe.");
expect(app.indexOf('app.use("/api/admin", requireAdmin)') < app.indexOf("setupTeamManagementRoutes(app)"), "Rotas da equipe devem ser montadas depois do middleware administrativo.");

// Regras de autorização aplicadas em toda mutação.
expect(routes.split("canManageMember(").length - 1 === 3, "Criar, alterar e redefinir senha devem checar canManageMember.");
expect(routes.includes("for update"), "Alteração deve travar o registro durante a transação.");

// Senhas: hash forte, nunca em auditoria/log.
expect(routes.includes("bcrypt.hash(senhaTemporaria, 12)"), "Senha temporária deve ser gravada só como hash bcrypt custo 12.");
const metadados = routes.split("sql.json(").slice(1).map((trecho) => trecho.slice(0, trecho.indexOf("`")));
expect(metadados.length === 3 && metadados.every((m) => !/senha|password/i.test(m)), "Auditoria não pode conter senha nem hash.");
expect(!/console\.\w+\([^)]*(senhaTemporaria|passwordHash|req\.body)/.test(routes), "Logs não podem conter senha, hash ou corpo da requisição.");
const listagem = routes.slice(routes.indexOf('app.get("/api/admin/equipe"'), routes.indexOf('app.post("/api/admin/equipe"'));
expect(listagem.length > 0 && !listagem.includes("password_hash"), "Listagem da equipe não pode devolver hash de senha.");

// Auditoria de todas as ações.
for (const acao of ["EQUIPE_CRIADA", "EQUIPE_ATUALIZADA", "EQUIPE_SENHA_REDEFINIDA"]) {
  expect(routes.includes(`'${acao}'`), `Ação ${acao} deve ser auditada.`);
}

// Tela: restrita a ADMIN e com aviso de exibição única.
expect(shell.includes('path="/admin/equipe" element={adminOnly('), "Tela de equipe deve exigir ADMIN no frontend.");
expect(page.includes("somente agora"), "Tela deve avisar que a senha temporária aparece uma única vez.");
expect(!page.includes("localStorage"), "Tela não pode guardar senha no navegador.");

console.log("Team management contract: ok");
