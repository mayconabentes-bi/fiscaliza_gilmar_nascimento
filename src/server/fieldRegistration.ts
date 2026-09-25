import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { getHealthyPostgres } from "./postgres.js";

/**
 * Staff authorization is enforced upstream by requireInternalAccess().
 * Each ticket is an opaque 256-bit bearer credential, never logged or stored raw.
 * Nothing works unless the explicit field-registration flag is enabled.
 */
export function fieldRegistrationEnabled() {
  return process.env.NODE_ENV === "production" &&
    process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION === "true";
}

export function fieldTicketHash(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^[0-9a-f]{64}$/.test(raw)) return null;
  return createHash("sha256").update(raw, "ascii").digest("hex");
}

export async function validUnusedFieldTicket(hash: string) {
  const sql = await getHealthyPostgres();
  const [row] = await sql`
    select exists(
      select 1 from private.field_registration_tickets t
      join private.admins a on a.id = t.assessor_id
      where t.token_hash = ${hash}
        and t.consumed_at is null and t.expires_at > now()
        and a.ativo = true
    ) as usable
  `;
  return row?.usable === true;
}

export async function insertCitizenWithFieldTicket(
  hash: string,
  citizen: {
    id: string; nomeCompleto: string; email: string; municipio: string; bairro: string;
    passwordHash: string; consentimento: boolean; acceptedAt: string | null;
    version: string | null; faixaEtaria: string; protecaoReforcada: boolean;
  },
): Promise<boolean> {
  const sql = await getHealthyPostgres();
  return sql.begin(async tx => {
    // The token row is locked through the UPDATE. A race/replay cannot spend
    // a token twice; a failure rolls back BOTH the citizen and consumption.
    const rows = await tx`
      select t.id from private.field_registration_tickets t
      join private.admins a on a.id = t.assessor_id
      where t.token_hash = ${hash} and t.consumed_at is null
        and t.expires_at > now() and a.ativo = true
      for update of t
    `;
    if (rows.length !== 1) return false;

    await tx`
      insert into public.usuarios (
        id, nome_completo, email, municipio, bairro, password_hash,
        consentimento_lgpd, data_consentimento, versao_consentimento,
        faixa_etaria, protecao_reforcada
      ) values (
        ${citizen.id}, ${citizen.nomeCompleto}, ${citizen.email},
        ${citizen.municipio}, ${citizen.bairro}, ${citizen.passwordHash},
        ${citizen.consentimento}, ${citizen.acceptedAt}, ${citizen.version},
        ${citizen.faixaEtaria}, ${citizen.protecaoReforcada}
      )
    `;
    const used = await tx`
      update private.field_registration_tickets
      set consumed_at = now(), citizen_id = ${citizen.id}
      where id = ${rows[0].id} and consumed_at is null
      returning id
    `;
    if (used.length !== 1) throw new Error("FIELD_TICKET_CONCURRENT_CONSUMPTION");
    return true;
  });
}

export function setupFieldTicketIssuance(app: Express) {
  // MOUNT AFTER app.use("/api/admin", requireInternalAccess).
  // The route is not accessible in development, on Vercel previews or when off.
  const issuanceLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 100,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: "Limite temporário de convites. Tente novamente." },
  });
  app.post("/api/admin/field-registration/tickets", issuanceLimiter,
    async (req: Request & { user?: { id?: string; perfil_acesso?: string } }, res) => {
      if (!fieldRegistrationEnabled()) return res.status(404).json({ error: "Indisponível." });
      const assessorId = req.user?.id;
      if (!assessorId || !/^[0-9a-f-]{36}$/i.test(assessorId)) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      try {
        const sql = await getHealthyPostgres();
        const raw = randomBytes(32).toString("hex");
        const hash = fieldTicketHash(raw)!;
        const id = randomUUID();
        const issued = await sql.begin(async tx => {
          // Prevent two concurrent requests from bypassing an assessor's quota.
          await tx`select pg_advisory_xact_lock(hashtext(${assessorId}))`;
          const [staff] = await tx`
            select id from private.admins where id = ${assessorId} and ativo = true
          `;
          if (!staff) return false;
          const [usage] = await tx`
            select count(*)::integer as count
            from private.field_registration_tickets
            where assessor_id = ${assessorId}
              and issued_at > now() - interval '1 hour'
          `;
          if (Number(usage?.count || 0) >= 20) return false;
          await tx`
            insert into private.field_registration_tickets (id, token_hash, assessor_id, expires_at)
            values (${id}, ${hash}, ${assessorId}, now() + interval '15 minutes')
          `;
          return true;
        });
        res.setHeader("Cache-Control", "no-store, private");
        if (!issued) return res.status(429).json({ error: "Limite ou autorização de convites indisponível." });
        return res.status(201).json({ ticket: raw, expiresInSeconds: 900 });
      } catch (error) {
        console.error("Falha ao gerar convite de cadastro presencial.");
        return res.status(503).json({ error: "Emissão de convite temporariamente indisponível." });
      }
    });
}
