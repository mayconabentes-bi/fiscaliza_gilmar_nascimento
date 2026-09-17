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

type PersistedAdminValidation = {
  state: "allowed" | "inactive" | "forbidden_profile";
  perfil_acesso?: string;
};

type CachedAdminValidation = PersistedAdminValidation & { expiresAt: number };

const ADMIN_REVALIDATION_TTL_MS = 10_000;
const adminValidationCache = new Map<string, CachedAdminValidation>();
const adminValidationInFlight = new Map<string, Promise<PersistedAdminValidation>>();

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function isAllowedAdminProfile(value?: string) {
  return value === "ADMIN" || value === "SUPER_ADMIN";
}

async function revalidateProductionAdmin(id: string): Promise<PersistedAdminValidation> {
  const cached = adminValidationCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return { state: cached.state, perfil_acesso: cached.perfil_acesso };
  }

  const existing = adminValidationInFlight.get(id);
  if (existing) return existing;

  const validation = (async () => {
    const sql = getPostgres();
    const [admin] = await sql`
      select id, ativo, perfil_acesso
      from private.admins
      where id = ${id}
      limit 1
    `;

    let result: PersistedAdminValidation;
    if (!admin || admin.ativo !== true) {
      result = { state: "inactive" };
    } else {
      const persistedProfile = String(admin.perfil_acesso || "ADMIN");
      result = isAllowedAdminProfile(persistedProfile)
        ? { state: "allowed", perfil_acesso: persistedProfile }
        : { state: "forbidden_profile", perfil_acesso: persistedProfile };
    }

    adminValidationCache.set(id, { ...result, expiresAt: Date.now() + ADMIN_REVALIDATION_TTL_MS });
    return result;
  })().finally(() => {
    adminValidationInFlight.delete(id);
  });

  adminValidationInFlight.set(id, validation);
  return validation;
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
        const persisted = await revalidateProductionAdmin(user.id);

        if (persisted.state === "inactive") {
          return res.status(403).json({ error: "Acesso administrativo desativado." });
        }

        if (persisted.state === "forbidden_profile") {
          return res.status(403).json({ error: "Perfil administrativo sem permissão para este núcleo." });
        }

        req.user = { ...user, perfil_acesso: persisted.perfil_acesso || user.perfil_acesso };
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
