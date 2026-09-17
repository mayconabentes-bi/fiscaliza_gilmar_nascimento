import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../server/db.js";

const errors: string[] = [];
const warnings: string[] = [];

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} não definido.`);
  return value || "";
}

function checkSecret(name: string) {
  const value = required(name);
  if (value && value.length < 32) errors.push(`${name} deve ter pelo menos 32 caracteres.`);
  if (/troque|gere-uma|exemplo/i.test(value)) errors.push(`${name} ainda parece conter valor de exemplo.`);
}

function ensureWritableDirectory(name: string, value: string) {
  if (!value) return;
  const absolute = path.resolve(process.cwd(), value);
  try {
    fs.mkdirSync(absolute, { recursive: true });
    const probe = path.join(absolute, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
  } catch (error: any) {
    errors.push(`${name} não está gravável: ${error.message}`);
  }
}

if (process.env.NODE_ENV !== "production") warnings.push("NODE_ENV não está em production.");
checkSecret("JWT_SECRET");
checkSecret("CPF_PEPPER");

const appOrigin = required("APP_ORIGIN");
if (appOrigin && !/^https:\/\//.test(appOrigin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(appOrigin)) {
  errors.push("APP_ORIGIN deve usar HTTPS, exceto localhost/127.0.0.1.");
}

const adminEmail = required("ADMIN_EMAIL");
if (/exemplo\.(org|com|br)$/i.test(adminEmail)) errors.push("ADMIN_EMAIL ainda usa domínio de exemplo.");
const adminPassword = required("ADMIN_PASSWORD");
if (adminPassword.length < 12 || /troque/i.test(adminPassword)) errors.push("ADMIN_PASSWORD deve ser uma senha real e forte.");
required("ADMIN_NAME");

const privacyEmail = required("DPO_CONTACT_EMAIL");
if (/exemplo\.(org|com|br)$/i.test(privacyEmail)) errors.push("DPO_CONTACT_EMAIL ainda usa domínio de exemplo.");
required("CIVIC_DB_PATH");
const backupDir = required("BACKUP_DIR");
const externalBackupDir = required("BACKUP_EXTERNAL_DIR");
ensureWritableDirectory("BACKUP_DIR", backupDir);
ensureWritableDirectory("BACKUP_EXTERNAL_DIR", externalBackupDir);

try {
  const db = getDb();
  const integrity = db.pragma("quick_check", { simple: true });
  if (integrity !== "ok") errors.push(`Banco falhou no quick_check: ${integrity}`);

  const admin = db.prepare("SELECT id, email, ativo FROM admins WHERE lower(email) = lower(?)").get(adminEmail) as any;
  if (!admin) errors.push("Administrador privado ainda não foi criado. Execute npm run admin:setup.");
  else if (admin.ativo !== 1) errors.push("Administrador privado está desativado.");

  const privacyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='demanda_privacidade'").get();
  if (!privacyTable) warnings.push("Tabela demanda_privacidade ainda não foi criada; inicie a aplicação uma vez.");
  db.close();
} catch (error: any) {
  errors.push(`Falha ao abrir/verificar banco: ${error.message}`);
}

if (warnings.length) {
  console.log("Avisos:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error("Ambiente privado NÃO está pronto:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Ambiente privado pronto.");
console.log(`Origem autorizada: ${appOrigin}`);
console.log("Administrador privado: validado");
console.log("Banco e diretórios de backup: validados");
