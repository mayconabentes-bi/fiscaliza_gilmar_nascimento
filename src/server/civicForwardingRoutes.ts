import type { Express } from "express";
import { v4 as uuidv4 } from "uuid";
import { getHealthyPostgres } from "./postgres.js";

const channels = new Set(["OUVIDORIA","PORTAL","EMAIL","PRESENCIAL","OFICIO","OUTRO"]);
const statuses = new Set(["PREPARADO","ENVIADO","PROTOCOLADO","AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"]);
const transitions: Record<string,string[]> = {
  PREPARADO:["ENVIADO","PROTOCOLADO","ENCERRADO"],
  ENVIADO:["PROTOCOLADO","AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"],
  PROTOCOLADO:["AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"],
  AGUARDANDO_RESPOSTA:["RESPONDIDO","ENCERRADO"],
  RESPONDIDO:["AGUARDANDO_RESPOSTA","ENCERRADO"],
  ENCERRADO:[],
};
function short(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}
function dateInput(value: unknown) {
  if (!value) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("INVALID_DATE");
  return new Date(value).toISOString();
}
function bad(res: any, reason="Dados inválidos para o encaminhamento.") { return res.status(400).json({error:reason}); }

// Must be mounted AFTER /api/admin requireInternalAccess middleware.
export function setupCivicForwardingRoutes(app: Express) {
  // Current civic phase: owner ADMIN only; staff roles cannot access these records.
  app.use("/api/admin/encaminhamentos", (req:any,res,next) => ["ADMIN","SUPER_ADMIN"].includes(String(req.user?.perfil_acesso)) ? next() : res.status(403).json({error:"Acesso restrito."}));
  app.use(/^\/api\/admin\/demandas\/[^/]+\/encaminhamentos$/, (req:any,res,next) => req.user?.perfil_acesso === "ADMIN" ? next() : res.status(403).json({error:"Acesso restrito."}));
  app.get("/api/admin/demandas/:id/encaminhamentos", async (req:any,res) => {
    try {
      const sql=await getHealthyPostgres();
      const rows=await sql`
        select e.id, e.destinatario, e.canal, e.referencia_externa, e.situacao,
               e.resumo, e.retorno_publico, e.observacao_privada, e.data_envio,
               e.data_protocolo, e.proxima_verificacao, e.created_at, e.updated_at
        from private.encaminhamentos_civicos e
        where e.demanda_id = ${req.params.id}::uuid
        and exists(select 1 from public.demandas d where d.id=e.demanda_id)
        order by e.created_at desc
      `;
      res.setHeader("Cache-Control","private, no-store");
      return res.json({items:rows});
    } catch(error:any) {
      if (error?.code==="22P02") return bad(res,"Identificador inválido.");
      console.error("Falha ao listar encaminhamentos:",error);
      return res.status(500).json({error:"Não foi possível carregar encaminhamentos."});
    }
  });

  app.post("/api/admin/demandas/:id/encaminhamentos", async (req:any,res) => {
    const destinatario=short(req.body?.destinatario,180);
    const canal=short(req.body?.canal,40);
    const resumo=short(req.body?.resumo,2000);
    const observacao=short(req.body?.observacao_privada,2000);
    if (!destinatario || !channels.has(canal) || !resumo) return bad(res);
    try {
      const sql=await getHealthyPostgres();
      const data=await sql.begin(async tx=>{
        const [demanda]=await tx`select id from public.demandas where id=${req.params.id}::uuid limit 1`;
        if (!demanda) return null;
        const id=uuidv4();
        const [row]=await tx`
          insert into private.encaminhamentos_civicos
            (id,demanda_id,destinatario,canal,resumo,observacao_privada,created_by)
          values (${id},${demanda.id},${destinatario},${canal},${resumo},${observacao||null},${req.user?.id || null})
          returning id, destinatario, canal, situacao, created_at
        `;
        await tx`
          insert into private.encaminhamentos_civicos_eventos
            (id,encaminhamento_id,autor_id,situacao_nova,nota_privada)
          values (${uuidv4()},${id},${req.user?.id||null},'PREPARADO',${observacao||null})
        `;
        return row;
      });
      if (!data) return res.status(404).json({error:"Demanda não encontrada."});
      res.setHeader("Cache-Control","private, no-store");
      return res.status(201).json(data);
    } catch(error:any) {
      if(error?.code==="22P02") return bad(res,"Identificador inválido.");
      console.error("Falha ao criar encaminhamento:",error);
      return res.status(500).json({error:"Não foi possível registrar o encaminhamento."});
    }
  });

  app.patch("/api/admin/encaminhamentos/:id", async (req:any,res) => {
    const situacao=short(req.body?.situacao,32);
    if(!statuses.has(situacao)) return bad(res,"Situação inválida.");
    const referencia=short(req.body?.referencia_externa,160);
    const retorno=short(req.body?.retorno_publico,2000);
    const observacao=short(req.body?.observacao_privada,2000);
    let dataEnvio: string|null, dataProtocolo: string|null, proxima: string|null;
    try {
      dataEnvio=dateInput(req.body?.data_envio);
      dataProtocolo=dateInput(req.body?.data_protocolo);
      proxima=dateInput(req.body?.proxima_verificacao);
    } catch {return bad(res,"Data inválida.");}
    try {
      const sql=await getHealthyPostgres();
      const result=await sql.begin(async tx=>{
        const [before]=await tx`
          select id,situacao,referencia_externa from private.encaminhamentos_civicos
          where id=${req.params.id}::uuid for update
        `;
        if(!before) return {error:"NOT_FOUND"};
        if(situacao!==before.situacao && !transitions[String(before.situacao)]?.includes(situacao)) return {error:"INVALID_TRANSITION"};
        if(situacao==="PROTOCOLADO" && !(referencia||before.referencia_externa)) return {error:"MISSING_REFERENCE"};
        const [updated]=await tx`
          update private.encaminhamentos_civicos set
            situacao=${situacao}, referencia_externa=coalesce(nullif(${referencia},''),referencia_externa),
            retorno_publico=coalesce(nullif(${retorno},''),retorno_publico),
            observacao_privada=coalesce(nullif(${observacao},''),observacao_privada),
            data_envio=coalesce(${dataEnvio},data_envio),
            data_protocolo=coalesce(${dataProtocolo},data_protocolo),
            proxima_verificacao=coalesce(${proxima},proxima_verificacao),
            updated_at=now()
          where id=${req.params.id}::uuid
          returning id,situacao,updated_at
        `;
        await tx`
          insert into private.encaminhamentos_civicos_eventos
            (id,encaminhamento_id,autor_id,situacao_anterior,situacao_nova,nota_privada)
          values (${uuidv4()},${req.params.id},${req.user?.id||null},${before.situacao},${situacao},${observacao||null})
        `;
        return updated;
      });
      if(result?.error==="NOT_FOUND") return res.status(404).json({error:"Encaminhamento não encontrado."});
      if(result?.error==="INVALID_TRANSITION") return res.status(409).json({error:"Transição de situação não permitida."});
      if(result?.error==="MISSING_REFERENCE") return bad(res,"Informe a referência externa antes de marcar como protocolado.");
      res.setHeader("Cache-Control","private, no-store");
      return res.json(result);
    } catch(error:any) {
      if(error?.code==="22P02") return bad(res,"Identificador inválido.");
      console.error("Falha ao atualizar encaminhamento:",error);
      return res.status(500).json({error:"Não foi possível atualizar encaminhamento."});
    }
  });
}
