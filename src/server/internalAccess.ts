import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";
import { getPostgres } from "./postgres.js";

type PrivateAdmin = {
  id?: string;
  type?: string;
  status?: string;
  perfil_acesso?: string;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function isAllowedAdminProfile(value?: string) {
  return value === "ADMIN" || value === "SUPER_ADMIN";
}

export function requireInternalAccess() {
  return async (req: Request & { user?: PrivateAdmin }, res: Response, next: NextFunction) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Autenticação administrativa obrigatória." });

    let user: PrivateAdmin;
    try {
      user = jwt.verify(token, jwtSecret()) as PrivateAdmin;
    } catch (error: any) {
      const configurationError = error?.message === "JWT_SECRET não configurado";
      return res.status(configurationError ? 503 : 403).json({
        error: configurationError ? "Servidor sem configuração de autenticação." : "Sessão inválida ou expirada.",
      });
    }

    if (!user.id || user.type !== "admin" || user.status !== "ativo" || !isAllowedAdminProfile(user.perfil_acesso)) {
      return res.status(403).json({ error: "Acesso restrito ao administrador privado." });
    }

    try {
      if (process.env.NODE_ENV === "production") {
        const sql = getPostgres();
        const [admin] = await sql`
          select id, ativo, perfil_acesso
          from private.admins
          where id = ${user.id}
          limit 1
        `;

        if (!admin || admin.ativo !== true) {
          return res.status(403).json({ error: "Acesso administrativo desativado." });
        }

        const persistedProfile = String(admin.perfil_acesso || "ADMIN");
        if (!isAllowedAdminProfile(persistedProfile)) {
          return res.status(403).json({ error: "Perfil administrativo sem permissão para este núcleo." });
        }

        req.user = { ...user, perfil_acesso: persistedProfile };
        return next();
      }

      const db = getDb();
      try {
        const admin = db.prepare("SELECT id, ativo FROM admins WHERE id = ?").get(user.id) as { id: string; ativo: number } | undefined;
        if (!admin || admin.ativo !== 1) return res.status(403).json({ error: "Acesso administrativo desativado." });
      } finally {
        db.close();
      }

      req.user = user;
      return next();
    } catch (error: any) {
      console.error("Falha ao revalidar administrador:", error);
      const configurationError = error?.message === "DATABASE_URL não configurada";
      return res.status(configurationError ? 503 : 500).json({
        error: configurationError ? "Servidor sem configuração de banco para autenticação administrativa." : "Não foi possível validar a sessão administrativa.",
      });
    }
  };
}
