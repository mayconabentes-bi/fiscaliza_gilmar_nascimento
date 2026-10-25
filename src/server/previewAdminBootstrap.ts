import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getHealthyPostgres } from "./postgres.js";

let bootstrapPromise: Promise<void> | null = null;

function previewEnabled() {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "preview";
}

function requiredPreviewAdminEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "ADMIN_NAME") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PREVIEW_ADMIN_CONFIG_MISSING:${name}`);
  return value;
}

async function provisionPreviewAdmin() {
  if (!previewEnabled()) return;

  const email = requiredPreviewAdminEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredPreviewAdminEnv("ADMIN_PASSWORD");
  const nome = requiredPreviewAdminEnv("ADMIN_NAME");

  const strongPassword =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!strongPassword) throw new Error("PREVIEW_ADMIN_PASSWORD_WEAK");

  const sql = await getHealthyPostgres();

  const [existing] = await sql`
    select id, nome, password_hash, ativo, perfil_acesso, setor_id
    from private.admins
    where lower(email) = lower(${email})
    limit 1
  `;

  if (existing) {
    const passwordMatches = await bcrypt.compare(password, String(existing.password_hash || ""));
    const alreadyConfigured =
      existing.nome === nome &&
      existing.ativo === true &&
      existing.perfil_acesso === "SUPER_ADMIN" &&
      existing.setor_id === null &&
      passwordMatches;
    if (alreadyConfigured) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await sql`
      update private.admins
      set nome = ${nome},
          password_hash = ${passwordHash},
          ativo = true,
          perfil_acesso = 'SUPER_ADMIN',
          setor_id = null,
          updated_at = now()
      where id = ${existing.id}
    `;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await sql`
    insert into private.admins (id, nome, email, password_hash, ativo, perfil_acesso, setor_id)
    values (${uuidv4()}, ${nome}, ${email}, ${passwordHash}, true, 'SUPER_ADMIN', null)
  `;
}

export async function ensurePreviewAdmin() {
  if (!previewEnabled()) return;
  if (!bootstrapPromise) {
    bootstrapPromise = provisionPreviewAdmin().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  await bootstrapPromise;
}
