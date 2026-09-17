import type { Express, Request } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function citizenClaims(req: Request) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, jwtSecret()) as any;
    return claims?.type === "cidadao" && claims?.id ? claims : null;
  } catch {
    return null;
  }
}

export function setupCitizenCompliancePostgres(app: Express) {
  app.post("/api/compliance/exportar", async (req, res) => {
    const claims = citizenClaims(req);
    if (!claims) return res.status(401).json({ error: "Entre na sua conta para exportar os dados." });

    try {
      const sql = getPostgres();
      const [user] = await sql`
        select id, nome_completo, email, municipio, bairro, status,
               consentimento_lgpd, data_consentimento, versao_consentimento, created_at
        from public.usuarios where id = ${claims.id} limit 1
      `;
      if (!user || user.status === "excluido") return res.status(404).json({ error: "Conta não encontrada." });

      const demandas = await sql`
        select protocolo, municipio, bairro, categoria, descricao, prioridade, status,
               aviso_privacidade_versao, aviso_privacidade_data, created_at, updated_at
        from public.demandas where usuario_id = ${claims.id} order by created_at desc
      `;

      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ dados: { conta: user, demandas, exportado_em: new Date().toISOString() } });
    } catch (error: any) {
      console.error("Falha ao exportar dados do titular:", error);
      return res.status(error?.message === "DATABASE_URL não configurada" ? 503 : 500).json({ error: "Não foi possível exportar os dados." });
    }
  });

  app.post("/api/compliance/excluir", async (req, res) => {
    const claims = citizenClaims(req);
    if (!claims) return res.status(401).json({ error: "Entre na sua conta para solicitar a exclusão." });

    try {
      const sql = getPostgres();
      const result = await sql.begin(async (tx) => {
        const [user] = await tx`select id, status from public.usuarios where id = ${claims.id} for update`;
        if (!user || user.status === "excluido") return false;

        await tx`update public.demandas set usuario_id = null where usuario_id = ${claims.id}`;
        const syntheticEmail = `excluido-${claims.id}@invalid.local`;
        const disabledHash = crypto.randomBytes(48).toString("hex");
        await tx`
          update public.usuarios
          set nome_completo = 'Conta excluída', email = ${syntheticEmail}, municipio = 'Removido',
              bairro = 'Removido', status = 'excluido', consentimento_lgpd = false,
              data_consentimento = null, versao_consentimento = null, password_hash = ${disabledHash}
          where id = ${claims.id}
        `;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'usuario', ${claims.id}, 'SOLICITACAO_EXCLUSAO', ${claims.id},
                  ${sql.json({ data: new Date().toISOString(), efeito: "conta pseudonimizada e demandas desvinculadas" })})
        `;
        return true;
      });

      if (!result) return res.status(404).json({ error: "Conta não encontrada." });
      res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
      return res.json({ success: true, message: "Conta desativada e dados cadastrais pseudonimizados. Registros cívicos necessários podem permanecer sem vínculo direto com a conta." });
    } catch (error: any) {
      console.error("Falha ao excluir/pseudonimizar conta:", error);
      return res.status(error?.message === "DATABASE_URL não configurada" ? 503 : 500).json({ error: "Não foi possível processar a solicitação." });
    }
  });
}
