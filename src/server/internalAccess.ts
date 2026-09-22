import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";
import { getHealthyPostgres } from "./postgres.js";
import {
  isAllowedAdminProfile,
  isSectorStaffProfile,
  isSectorStaffRoute,
  isStaffProfile,
  type EscopoAcesso,
} from "./adminAccessPolicy.js";

type PrivateAdmin = {
  id?: string;
  type?: string;
  status?: string;
  perfil_acesso?: string;
  escopo?: EscopoAcesso;
};

type PersistedAdminValidation = {
  state: "allowed" | "inactive" | "forbidden_profile" | "missing_sector";
  perfil_acesso?: string;
  escopo?: EscopoAcesso;
};

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

async function revalidateProductionAdmin(id: string): Promise<PersistedAdminValidation> {
  const sql = await getHealthyPostgres();
  const [admin] = await sql`
    select a.id, a.ativo, a.perfil_acesso, a.setor_id, s.ativo as setor_ativo,
           coalesce(array_agg(sc.categoria) filter (where sc.categoria is not null), '{}') as categorias
    from private.admins a
    left join private.setores s on s.id = a.setor_id
    left join private.setor_categorias sc on sc.setor_id = s.id
    where a.id = ${id}
    group by a.id, a.ativo, a.perfil_acesso, a.setor_id, s.ativo
    limit 1
  `;

  if (!admin || admin.ativo !== true) return { state: "inactive" };

  const persistedProfile = String(admin.perfil_acesso || "");

  if (isAllowedAdminProfile(persistedProfile)) {
    return { state: "allowed", perfil_acesso: persistedProfile, escopo: { tipo: "TOTAL", setorId: null } };
  }

  if (isSectorStaffProfile(persistedProfile)) {
    const categorias = Array.isArray(admin.categorias) ? admin.categorias.map(String) : [];
    // Equipe de setor sem setor ativo ou sem categorias não acessa nada.
    if (!admin.setor_id || admin.setor_ativo !== true || categorias.length === 0) {
      return { state: "missing_sector", perfil_acesso: persistedProfile };
    }
    return {
      state: "allowed",
      perfil_acesso: persistedProfile,
      escopo: { tipo: "SETOR", setorId: String(admin.setor_id), categorias },
    };
  }

  return { state: "forbidden_profile", perfil_acesso: persistedProfile };
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

    if (!user.id || user.type !== "admin" || user.status !== "ativo" || !isStaffProfile(user.perfil_acesso)) {
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

        if (persisted.state === "missing_sector" || !persisted.escopo) {
          return res.status(403).json({ error: "Usuário sem setor ativo configurado." });
        }

        // Negar por padrão: equipe de setor só acessa as rotas da lista fechada.
        if (persisted.escopo.tipo === "SETOR" && !isSectorStaffRoute(req.method, req.originalUrl)) {
          return res.status(403).json({ error: "Perfil de setor sem permissão para esta área." });
        }

        req.user = { ...user, perfil_acesso: persisted.perfil_acesso || user.perfil_acesso, escopo: persisted.escopo };
        return next();
      }

      // Ambiente local (SQLite) não possui setores: somente ADMIN/SUPER_ADMIN.
      if (!isAllowedAdminProfile(user.perfil_acesso)) {
        return res.status(403).json({ error: "Perfil de setor disponível apenas com a persistência de produção." });
      }

      const db = getDb();
      try {
        const admin = db.prepare("SELECT id, ativo FROM admins WHERE id = ?").get(user.id) as { id: string; ativo: number } | undefined;
        if (!admin || admin.ativo !== 1) return res.status(403).json({ error: "Acesso administrativo desativado." });
      } finally {
        db.close();
      }

      req.user = { ...user, escopo: { tipo: "TOTAL", setorId: null } };
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
