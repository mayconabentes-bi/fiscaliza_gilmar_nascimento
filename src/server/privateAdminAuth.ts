import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";
import { getHealthyPostgres } from "./postgres.js";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

export function ensurePrivateAdminSchema() {
  if (process.env.NODE_ENV === "production") return;
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
    `);
  } finally { db.close(); }
}

export function setupPrivateAdminAuth(app: Express) {
  app.post("/api/auth/admin/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios." });

    try {
      let admin: any;
      if (process.env.NODE_ENV === "production") {
        const sql = await getHealthyPostgres();
        [admin] = await sql`
          select id, nome, email, password_hash, ativo, perfil_acesso
          from private.admins where lower(email) = lower(${email}) limit 1
        `;
        if (!admin || admin.ativo !== true) return res.status(401).json({ error: "Credenciais inválidas." });
      } else {
        const db = getDb();
        try { admin = db.prepare(`SELECT id, nome, email, password_hash, ativo FROM admins WHERE email = ?`).get(email); }
        finally { db.close(); }
        if (!admin || admin.ativo !== 1) return res.status(401).json({ error: "Credenciais inválidas." });
      }

      const valid = await bcrypt.compare(password, String(admin.password_hash));
      if (!valid) return res.status(401).json({ error: "Credenciais inválidas." });
      const perfil = String(admin.perfil_acesso || "ADMIN");
      const token = jwt.sign({ id: admin.id, type: "admin", status: "ativo", perfil_acesso: perfil }, jwtSecret(), { expiresIn: "12h" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 12 * 60 * 60 * 1000 });
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ user: { id: admin.id, nome: admin.nome, email: admin.email, type: "admin", perfil_acesso: perfil } });
    } catch (error: any) {
      console.error("Falha ao autenticar administrador:", error);
      const configError = error?.message === "DATABASE_URL não configurada" || error?.message === "JWT_SECRET não configurado";
      return res.status(configError ? 503 : 500).json({ error: configError ? "Servidor sem configuração de autenticação administrativa." : "Falha ao autenticar." });
    }
  });

  app.get("/api/auth/session", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    const token = req.cookies?.token;
    if (!token) return next();

    let claims: any;
    try {
      claims = jwt.verify(token, jwtSecret()) as any;
    } catch {
      return next();
    }

    if (claims.type !== "admin") return next();
    if (!claims.id || claims.status !== "ativo" || !["ADMIN", "SUPER_ADMIN"].includes(String(claims.perfil_acesso || ""))) {
      return res.status(401).json({ authenticated: false });
    }

    // Esta rota hidrata apenas a interface. A autorização real das APIs privadas
    // continua sendo revalidada pelo middleware administrativo.
    res.setHeader("Cache-Control", "no-store, private");
    return res.json({
      authenticated: true,
      user: {
        id: claims.id,
        nome: "Administrador FISCALIZE",
        email: null,
        type: "admin",
        perfil_acesso: String(claims.perfil_acesso),
      },
    });
  });
}
