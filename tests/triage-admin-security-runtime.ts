import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fiscalize-t1-admin-"));
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "t1-admin-security-test-secret-32-characters-minimum";
process.env.CIVIC_DB_PATH = path.join(tmp, "civic.db");

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function responseRecorder() {
  const state: any = { statusCode: 200, body: undefined };
  return {
    state,
    status(code: number) { state.statusCode = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  };
}

async function runMiddleware(token?: string) {
  const { requireInternalAccess } = await import("../src/server/internalAccess.js");
  const req: any = { cookies: token ? { token } : {} };
  const res: any = responseRecorder();
  let nextCalled = false;
  await requireInternalAccess()(req, res, () => { nextCalled = true; });
  return { ...res.state, nextCalled, user: req.user };
}

const db = new Database(process.env.CIVIC_DB_PATH);
db.exec(`
  create table admins (
    id text primary key,
    nome text not null,
    email text unique not null,
    password_hash text not null,
    ativo integer not null default 1
  );
`);
db.prepare("insert into admins (id,nome,email,password_hash,ativo) values (?,?,?,?,?)")
  .run("admin-1","Admin","admin@example.org","unused",1);
db.prepare("insert into admins (id,nome,email,password_hash,ativo) values (?,?,?,?,?)")
  .run("admin-off","Admin Off","off@example.org","unused",0);
db.close();

const secret = process.env.JWT_SECRET!;

let result = await runMiddleware();
expect(result.statusCode === 401 && !result.nextCalled, "Visitante sem token deve receber 401.");

result = await runMiddleware("token-invalido");
expect(result.statusCode === 403 && !result.nextCalled, "JWT inválido deve receber 403.");

const citizen = jwt.sign({ id:"citizen-1", type:"cidadao", status:"ativo" }, secret, { expiresIn:"1h" });
result = await runMiddleware(citizen);
expect(result.statusCode === 403 && !result.nextCalled, "Token cidadão não pode atravessar perímetro admin.");

const wrongProfile = jwt.sign({ id:"admin-1", type:"admin", status:"ativo", perfil_acesso:"OPERADOR" }, secret, { expiresIn:"1h" });
result = await runMiddleware(wrongProfile);
expect(result.statusCode === 403 && !result.nextCalled, "Perfil não permitido deve receber 403.");

const expired = jwt.sign({ id:"admin-1", type:"admin", status:"ativo", perfil_acesso:"ADMIN" }, secret, { expiresIn:-1 });
result = await runMiddleware(expired);
expect(result.statusCode === 403 && !result.nextCalled, "JWT expirado deve receber 403.");

const inactive = jwt.sign({ id:"admin-off", type:"admin", status:"ativo", perfil_acesso:"ADMIN" }, secret, { expiresIn:"1h" });
result = await runMiddleware(inactive);
expect(result.statusCode === 403 && !result.nextCalled, "Admin persistido inativo deve receber 403.");

const admin = jwt.sign({ id:"admin-1", type:"admin", status:"ativo", perfil_acesso:"ADMIN" }, secret, { expiresIn:"1h" });
result = await runMiddleware(admin);
expect(result.statusCode === 200 && result.nextCalled, "ADMIN ativo deve atravessar o middleware.");
expect(result.user?.id === "admin-1", "Middleware deve anexar identidade administrativa validada.");

const superAdmin = jwt.sign({ id:"admin-1", type:"admin", status:"ativo", perfil_acesso:"SUPER_ADMIN" }, secret, { expiresIn:"1h" });
result = await runMiddleware(superAdmin);
expect(result.statusCode === 200 && result.nextCalled, "SUPER_ADMIN ativo deve atravessar o middleware.");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("T1 admin security runtime: ok");
