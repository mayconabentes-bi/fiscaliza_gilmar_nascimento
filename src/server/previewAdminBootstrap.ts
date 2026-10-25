import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";

const PREVIEW_BRANCH = "feat/central-encaminhamentos-civicos";

let bootstrapPromise: Promise<void> | null = null;

function previewEnabled() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH
  );
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

  if (password.length < 12) throw new Error("PREVIEW_ADMIN_PASSWORD_WEAK");

  const passwordHash = await bcrypt.hash(password, 12);
  const sql = getPostgres();

  const [existing] = await sql`
    select id
    from private.admins
    where lower(email) = lower(${email})
    limit 1
  `;

  if (existing) {
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
