import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const helper = read("src/server/citizenSessionSecurity.ts");
const auth = read("src/server/citizenAuthPostgres.ts");
const demand = read("src/server/citizenDemandPostgres.ts");
const compliance = read("src/server/citizenCompliancePostgres.ts");

expect(helper.includes("crypto.timingSafeEqual"), "Fingerprint da sessão deve usar comparação de tamanho constante.");
expect(helper.includes("citizenPasswordFingerprint"), "Fingerprint da senha deve estar centralizado.");
expect(auth.includes('from "./citizenSessionSecurity.js"'), "Autenticação deve usar o helper compartilhado.");
expect(auth.includes("pwd: passwordFingerprint"), "JWT cidadão deve continuar vinculado ao hash atual da senha.");

const demandPost = demand.slice(
  demand.indexOf('app.post("/api/demandas"'),
  demand.indexOf('app.get("/api/minha-conta/demandas"'),
);
expect(demandPost.includes("password_hash"), "Registro autenticado deve carregar o hash atual da conta.");
expect(demandPost.includes("isCitizenSessionCurrent(claims.pwd, user.password_hash)"), "Registro autenticado deve recusar token anterior à troca de senha.");
expect(demandPost.includes('res.clearCookie("token"'), "Registro autenticado deve limpar cookie obsoleto.");

const myRecords = demand.slice(
  demand.indexOf('app.get("/api/minha-conta/demandas"'),
  demand.indexOf('app.get("/api/demandas/protocolo/:protocolo"'),
);
expect(myRecords.includes("password_hash"), "Meus registros deve carregar o hash atual da conta.");
expect(myRecords.includes("isCitizenSessionCurrent(claims.pwd, user.password_hash)"), "Meus registros deve recusar token revogado por troca de senha.");
expect(myRecords.includes("res.status(401)"), "Meus registros deve falhar fechado para sessão obsoleta.");

const exportBlock = compliance.slice(
  compliance.indexOf('app.post("/api/compliance/exportar"'),
  compliance.indexOf('app.post("/api/compliance/excluir"'),
);
expect(exportBlock.includes("password_hash"), "Exportação LGPD deve revalidar a credencial atual.");
expect(exportBlock.includes("isCitizenSessionCurrent(claims.pwd, user.password_hash)"), "Exportação LGPD deve recusar token revogado.");
expect(!exportBlock.includes("conta: user"), "Exportação LGPD não pode devolver password_hash por acidente.");

const deleteBlock = compliance.slice(compliance.indexOf('app.post("/api/compliance/excluir"'));
expect(deleteBlock.includes("for update"), "Exclusão deve manter serialização do registro do usuário.");
expect(deleteBlock.includes("password_hash"), "Exclusão deve validar a senha atual dentro da transação.");
expect(deleteBlock.includes("isCitizenSessionCurrent(claims.pwd, user.password_hash)"), "Exclusão deve recusar token revogado.");
expect(deleteBlock.includes('"invalid_session"'), "Exclusão deve distinguir sessão revogada antes de qualquer mutação.");

console.log("Citizen session security contract: OK");
