import { randomInt } from "node:crypto";
import { isAllowedAdminProfile, isSectorStaffProfile, isStaffProfile, type StaffProfile } from "./adminAccessPolicy.js";

/**
 * Regras de gestão da equipe interna (Fase 1).
 * Funções puras: sem banco, para que possam ser testadas isoladamente.
 */

export const TEAM_NAME_MAX = 120;
export const TEAM_EMAIL_MAX = 254;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Tipos "planos" (sem união): o tsconfig do projeto não usa strict, e sem
// strictNullChecks o TypeScript não estreita uniões pelo campo ok.
type Decision = { ok: boolean; status: number; error: string };

const allow: Decision = { ok: true, status: 200, error: "" };
const deny = (status: number, error: string): Decision => ({ ok: false, status, error });

/**
 * Quem pode gerenciar quem.
 * - Ninguém altera a própria conta por aqui (evita autopromoção e autobloqueio).
 * - ADMIN gerencia COORDENADOR e ATENDENTE.
 * - Criar, alterar ou promover para ADMIN/SUPER_ADMIN exige SUPER_ADMIN.
 */
export function canManageMember(input: {
  actorId: string;
  actorPerfil: unknown;
  targetId?: string | null;
  targetPerfilAtual?: unknown;
  perfilDesejado?: unknown;
}): Decision {
  if (!isAllowedAdminProfile(input.actorPerfil)) return deny(403, "Somente administradores gerenciam a equipe.");
  if (input.targetId && input.targetId === input.actorId) {
    return deny(403, "Não é permitido alterar a própria conta por esta tela.");
  }

  const mexeEmAdmin =
    isAllowedAdminProfile(input.targetPerfilAtual) || isAllowedAdminProfile(input.perfilDesejado);
  if (mexeEmAdmin && input.actorPerfil !== "SUPER_ADMIN") {
    return deny(403, "Somente SUPER_ADMIN cria ou altera contas de administrador.");
  }
  return allow;
}

type NewMember = { nome: string; email: string; perfil: StaffProfile; setorId: string | null };

export function validateNewMember(body: any): { ok: boolean; error: string; value: NewMember | null } {
  const nome = String(body?.nome || "").trim().replace(/\s+/g, " ");
  const email = String(body?.email || "").trim().toLowerCase();
  const perfil = String(body?.perfil_acesso || "").trim();
  const setorId = String(body?.setor_id || "").trim() || null;

  if (nome.length < 3 || nome.length > TEAM_NAME_MAX) return { ok: false, error: "Informe o nome completo (3 a 120 caracteres).", value: null };
  if (email.length > TEAM_EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido.", value: null };
  if (!isStaffProfile(perfil)) return { ok: false, error: "Papel inválido.", value: null };
  if (isSectorStaffProfile(perfil) && !setorId) return { ok: false, error: "Coordenador e Atendente precisam de um setor.", value: null };
  if (setorId && !isUuid(setorId)) return { ok: false, error: "Setor inválido.", value: null };

  return { ok: true, error: "", value: { nome, email, perfil, setorId: isSectorStaffProfile(perfil) ? setorId : null } };
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*-_+=?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/**
 * Senha temporária forte (16 caracteres, com maiúscula, minúscula, número e símbolo),
 * gerada com fonte criptográfica. Exibida uma única vez para o administrador.
 */
export function generateTemporaryPassword(length = 16): string {
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}