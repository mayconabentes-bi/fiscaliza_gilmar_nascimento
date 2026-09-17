import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type RadarAdmin = {
  id?: string;
  type?: string;
  status?: string;
  perfil_acesso?: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return secret;
}

export function requireRadarGestor(req: Request & { user?: RadarAdmin }, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Autenticação administrativa obrigatória." });

  let user: RadarAdmin;
  try {
    user = jwt.verify(token, getJwtSecret()) as RadarAdmin;
  } catch (error: any) {
    const configurationError = error?.message === "JWT_SECRET não configurado";
    return res.status(configurationError ? 503 : 403).json({
      error: configurationError ? "Servidor sem configuração de autenticação." : "Token inválido ou expirado.",
    });
  }

  if (user.type !== "admin" || user.status !== "ativo" || user.perfil_acesso !== "ADMIN") {
    return res.status(403).json({ error: "Radar Territorial restrito ao administrador privado." });
  }

  req.user = user;
  next();
}
