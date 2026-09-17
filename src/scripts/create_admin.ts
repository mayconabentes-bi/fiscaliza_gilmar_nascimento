import "dotenv/config";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../server/db.js";
import { getPostgres } from "../server/postgres.js";
import { ensurePrivateAdminSchema } from "../server/privateAdminAuth.js";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente no .env: ${name}`);
  return value;
}

function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 12) errors.push("mínimo de 12 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("uma letra maiúscula");
  if (!/[a-z]/.test(password)) errors.push("uma letra minúscula");
  if (!/[0-9]/.test(password)) errors.push("um número");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("um caractere especial");
  if (errors.length) throw new Error(`ADMIN_PASSWORD fraca: exige ${errors.join(", ")}.`);
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");
  const nome = requiredEnv("ADMIN_NAME");
  validatePassword(password);
  const passwordHash = await bcrypt.hash(password, 12);

  if (process.env.NODE_ENV === "production") {
    const sql = getPostgres();
    const [existing] = await sql`select id from private.admins where lower(email) = lower(${email}) limit 1`;
    if (existing) {
      await sql`
        update private.admins set nome = ${nome}, password_hash = ${passwordHash}, ativo = true,
          perfil_acesso = 'ADMIN', updated_at = now() where id = ${existing.id}
      `;
      console.log("Administrador privado Postgres atualizado com sucesso.");
      return;
    }
    await sql`
      insert into private.admins (id, nome, email, password_hash, ativo, perfil_acesso)
      values (${uuidv4()}, ${nome}, ${email}, ${passwordHash}, true, 'ADMIN')
    `;
    console.log("Administrador privado Postgres criado com sucesso.");
    return;
  }

  ensurePrivateAdminSchema();
  const db = getDb();
  try {
    const existing = db.prepare("SELECT id FROM admins WHERE email = ?").get(email) as any | undefined;
    if (existing) {
      db.prepare("UPDATE admins SET nome = ?, password_hash = ?, ativo = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(nome, passwordHash, existing.id);
      console.log("Administrador privado local atualizado com sucesso.");
      return;
    }
    db.prepare("INSERT INTO admins (id, nome, email, password_hash, ativo) VALUES (?, ?, ?, ?, 1)")
      .run(uuidv4(), nome, email, passwordHash);
    console.log("Administrador privado local criado com sucesso.");
  } finally { db.close(); }
}

main().catch((error) => {
  console.error("Falha ao criar/atualizar administrador privado.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
