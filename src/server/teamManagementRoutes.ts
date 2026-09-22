import type { Express } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";
import { isSectorStaffProfile, isStaffProfile } from "./adminAccessPolicy.js";
import { canManageMember, generateTemporaryPassword, isUuid, validateNewMember } from "./teamPolicy.js";

/**
 * Gestão da equipe interna (Fase 1).
 * Montada sob /api/admin: exige login e, por não estar na lista de rotas de setor,
 * fica restrita a ADMIN/SUPER_ADMIN pelo requireInternalAccess.
 * Senhas nunca são registradas em log ou auditoria; a temporária é devolvida uma única vez.
 */
export function setupTeamManagementRoutes(app: Express) {
  app.get("/api/admin/equipe", async (_req, res) => {
    try {
      const sql = getPostgres();
      const [membros, setores] = await Promise.all([
        sql`
          select a.id, a.nome, a.email, a.perfil_acesso, a.ativo, a.setor_id,
                 s.nome as setor_nome, a.created_at, a.updated_at
          from private.admins a
          left join private.setores s on s.id = a.setor_id
          order by a.ativo desc, a.nome asc
        `,
        sql`select id, codigo, nome, ativo from private.setores order by nome asc`,
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ membros, setores });
    } catch (error) {
      console.error("Falha ao listar equipe:", error);
      return res.status(500).json({ error: "Não foi possível carregar a equipe." });
    }
  });

  app.post("/api/admin/equipe", async (req: any, res) => {
    const parsed = validateNewMember(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { nome, email, perfil, setorId } = parsed.value;

    const decision = canManageMember({ actorId: req.user?.id, actorPerfil: req.user?.perfil_acesso, perfilDesejado: perfil });
    if (!decision.ok) return res.status(decision.status).json({ error: decision.error });

    try {
      const sql = getPostgres();
      if (setorId) {
        const [setor] = await sql`select id from private.setores where id = ${setorId}::uuid and ativo = true limit 1`;
        if (!setor) return res.status(400).json({ error: "Setor inexistente ou inativo." });
      }

      const senhaTemporaria = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(senhaTemporaria, 12);
      const id = uuidv4();

      await sql.begin(async (tx) => {
        await tx`
          insert into private.admins (id, nome, email, password_hash, ativo, perfil_acesso, setor_id)
          values (${id}, ${nome}, ${email}, ${passwordHash}, true, ${perfil}, ${setorId})
        `;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'equipe', ${id}, 'EQUIPE_CRIADA', ${req.user?.id || null},
                  ${sql.json({ perfil_acesso: perfil, setor_id: setorId })})
        `;
      });

      res.setHeader("Cache-Control", "no-store, private");
      return res.status(201).json({ id, nome, email, perfil_acesso: perfil, setor_id: setorId, senha_temporaria: senhaTemporaria });
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
      console.error("Falha ao criar membro da equipe:", error);
      return res.status(500).json({ error: "Não foi possível criar o membro da equipe." });
    }
  });

  app.patch("/api/admin/equipe/:id", async (req: any, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Membro não encontrado." });
    const temPerfil = req.body?.perfil_acesso !== undefined;
    const temSetor = req.body?.setor_id !== undefined;
    const temAtivo = req.body?.ativo !== undefined;
    if (!temPerfil && !temSetor && !temAtivo) return res.status(400).json({ error: "Nada para alterar." });
    if (temPerfil && !isStaffProfile(req.body.perfil_acesso)) return res.status(400).json({ error: "Papel inválido." });
    if (temAtivo && typeof req.body.ativo !== "boolean") return res.status(400).json({ error: "Situação inválida." });
    if (temSetor && req.body.setor_id && !isUuid(String(req.body.setor_id))) return res.status(400).json({ error: "Setor inválido." });

    try {
      const sql = getPostgres();
      const result = await sql.begin(async (tx) => {
        const [atual] = await tx`
          select id, perfil_acesso, setor_id, ativo from private.admins where id = ${req.params.id} for update
        `;
        if (!atual) return { status: 404, body: { error: "Membro não encontrado." } };

        const novoPerfil = temPerfil ? String(req.body.perfil_acesso) : String(atual.perfil_acesso);
        const decision = canManageMember({
          actorId: req.user?.id,
          actorPerfil: req.user?.perfil_acesso,
          targetId: String(atual.id),
          targetPerfilAtual: atual.perfil_acesso,
          perfilDesejado: novoPerfil,
        });
        if (!decision.ok) return { status: decision.status, body: { error: decision.error } };

        let novoSetor: string | null = temSetor ? (String(req.body.setor_id || "").trim() || null) : (atual.setor_id ? String(atual.setor_id) : null);
        if (!isSectorStaffProfile(novoPerfil)) novoSetor = null;
        if (isSectorStaffProfile(novoPerfil) && !novoSetor) {
          return { status: 400, body: { error: "Coordenador e Atendente precisam de um setor." } };
        }
        if (novoSetor) {
          const [setor] = await tx`select id from private.setores where id = ${novoSetor}::uuid and ativo = true limit 1`;
          if (!setor) return { status: 400, body: { error: "Setor inexistente ou inativo." } };
        }
        const novoAtivo = temAtivo ? Boolean(req.body.ativo) : Boolean(atual.ativo);

        await tx`
          update private.admins
          set perfil_acesso = ${novoPerfil}, setor_id = ${novoSetor}, ativo = ${novoAtivo}, updated_at = now()
          where id = ${atual.id}
        `;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'equipe', ${String(atual.id)}, 'EQUIPE_ATUALIZADA', ${req.user?.id || null},
                  ${sql.json({
                    antes: { perfil_acesso: atual.perfil_acesso, setor_id: atual.setor_id, ativo: atual.ativo },
                    depois: { perfil_acesso: novoPerfil, setor_id: novoSetor, ativo: novoAtivo },
                  })})
        `;
        return { status: 200, body: { success: true, id: atual.id, perfil_acesso: novoPerfil, setor_id: novoSetor, ativo: novoAtivo } };
      });

      res.setHeader("Cache-Control", "no-store, private");
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Falha ao atualizar membro da equipe:", error);
      return res.status(500).json({ error: "Não foi possível atualizar o membro da equipe." });
    }
  });

  app.post("/api/admin/equipe/:id/senha-temporaria", async (req: any, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: "Membro não encontrado." });
    try {
      const sql = getPostgres();
      const [alvo] = await sql`select id, perfil_acesso from private.admins where id = ${req.params.id} limit 1`;
      if (!alvo) return res.status(404).json({ error: "Membro não encontrado." });

      const decision = canManageMember({
        actorId: req.user?.id,
        actorPerfil: req.user?.perfil_acesso,
        targetId: String(alvo.id),
        targetPerfilAtual: alvo.perfil_acesso,
      });
      if (!decision.ok) return res.status(decision.status).json({ error: decision.error });

      const senhaTemporaria = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(senhaTemporaria, 12);
      await sql.begin(async (tx) => {
        await tx`update private.admins set password_hash = ${passwordHash}, updated_at = now() where id = ${alvo.id}`;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'equipe', ${String(alvo.id)}, 'EQUIPE_SENHA_REDEFINIDA', ${req.user?.id || null}, ${sql.json({})})
        `;
      });

      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ id: alvo.id, senha_temporaria: senhaTemporaria });
    } catch (error) {
      console.error("Falha ao redefinir senha do membro:", error);
      return res.status(500).json({ error: "Não foi possível gerar uma nova senha temporária." });
    }
  });
}
