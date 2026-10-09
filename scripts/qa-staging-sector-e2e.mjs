#!/usr/bin/env node
/**
 * QA integrada no Railway HOMOLOGACAO SOMENTE.
 *
 * Por padrao NAO GRAVA. Para executar: node scripts/qa-staging-sector-e2e.mjs --execute
 * Para recuperar um lote interrompido: ... --cleanup=<codigo_de_16_hex>
 * IDs e senhas temporarias permanecem na memoria; imprime apenas status e codigo do lote.
 * NUNCA copie contas/demandas reais. AUDITORIA gerada pela API e preservada.
 */
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

const PROJECT="acd59c0a-4723-4162-9bfc-33bab1f096b0";
const ENV="32940765-7ef3-41c1-a017-48ad13120d65";
const SERVICE="98959349-60d9-4363-b7c3-e20e04e93a71";
const REF="zqxouixpokuprqqscnwf";
const ORIGIN="https://fiscalize-homologacao-homologacao.up.railway.app";
const allowedArgs=process.argv.slice(2);
const execute=allowedArgs.length===1 && allowedArgs[0]==="--execute";
const cleanupArg=allowedArgs.length===1 && /^--cleanup=[a-f0-9]{16}$/.test(allowedArgs[0]);
if(allowedArgs.length && !execute && !cleanupArg){
  console.log("QA_MODO=INVALIDO");process.exit(2);
}
function validDatabase(raw) {
  try {
    const u=new URL(raw);
    if(!["postgres:","postgresql:"].includes(u.protocol) || !u.password || u.searchParams.has("sslmode") && u.searchParams.get("sslmode")==="disable")return false;
    const host=u.hostname.toLowerCase(),username=decodeURIComponent(u.username).toLowerCase();
    return (host==="db."+REF+".supabase.co" && (username==="postgres"||username==="postgres."+REF)) ||
      (/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) && username==="postgres."+REF);
  } catch{return false;}
}
export function checkTarget(e) {
  return e.RAILWAY_PROJECT_ID===PROJECT && e.RAILWAY_ENVIRONMENT_ID===ENV &&
    e.RAILWAY_SERVICE_ID===SERVICE && e.RAILWAY_ENVIRONMENT_NAME==="homologacao" &&
    e.SUPABASE_URL==="https://"+REF+".supabase.co" && validDatabase(e.DATABASE_URL||"");
}
export function labels(run) {
  if(!/^[a-f0-9]{16}$/.test(run))throw Error("BAD_RUN");
  return {
    emails:["qa-fiscalize-"+run+"-saude@example.invalid","qa-fiscalize-"+run+"-infra@example.invalid"],
    protocols:["QA-"+run+"-SAUDE","QA-"+run+"-INFRA"],
    descriptions:["QA FISCALIZE "+run+" SAUDE","QA FISCALIZE "+run+" INFRA"],
  };
}
if(import.meta.url===new URL("file://"+process.argv[1]?.replace(/\\/g,"/")).href && false) {
  // Dummy branch to keep imports inert; main guard below uses direct Node argument.
}
const isMain=process.argv[1] && (await import("node:url")).pathToFileURL((await import("node:path")).resolve(process.argv[1])).href===import.meta.url;
if(isMain)await main();
async function main() {
  if(!checkTarget(process.env)){
    console.log("QA_GUARDA=BLOQUEADO");process.exitCode=2;return;
  }
  console.log("QA_GUARDA=OK");
  const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:"require",connect_timeout:6,idle_timeout:2,max_lifetime:60});
  const run=cleanupArg?allowedArgs[0].slice("--cleanup=".length):randomBytes(8).toString("hex");
  const lab=labels(run);
  let interrupted=false, attempted=false, failure=false, cleaned=false;
  process.on("SIGINT",()=>{interrupted=true});
  process.on("SIGTERM",()=>{interrupted=true});
  console.log("QA_LOTE="+run);
  try {
    // Consulta pontual, sem e-mails/identificadores de dados existentes.
    const [counts]=await sql.unsafe("select (select count(*)::int from private.admins) as admins,(select count(*)::int from public.demandas) as demandas,(select count(*)::int from private.setores) as setores,(select count(*)::int from private.setor_categorias) as categorias");
    if(!counts || counts.setores!==9 || counts.categorias!==9 || counts.admins>12 || counts.demandas>12)throw Error("BASELINE_INVALIDA");
    const sectors=await sql.unsafe("select s.id,s.codigo from private.setores s join private.setor_categorias sc on sc.setor_id=s.id and sc.categoria=s.codigo where s.codigo in ('SAUDE','INFRAESTRUTURA_URBANA') and s.ativo=true");
    if(sectors.length!==2 || new Set(sectors.map(x=>x.codigo)).size!==2)throw Error("SETORES_INVALIDOS");
    console.log("QA_BASELINE=OK");
    if(cleanupArg){
      cleaned=await cleanup(sql,lab);
      console.log("QA_LIMPEZA="+(cleaned?"OK":"PENDENTE"));
      return;
    }
    if(!execute){
      console.log("QA_MODO=SIMULACAO_SEM_GRAVACAO");
      console.log("QA_EXECUCAO=NAO_REALIZADA");
      return;
    }
    if(interrupted)throw Error("INTERRUPTED");
    const users=[
      {id:randomUUID(),name:"QA FISCALIZE SAUDE",email:lab.emails[0],pass:randomBytes(24).toString("base64url")+"!aA9",sector:sectors.find(x=>x.codigo==="SAUDE").id,cat:"SAUDE"},
      {id:randomUUID(),name:"QA FISCALIZE INFRA",email:lab.emails[1],pass:randomBytes(24).toString("base64url")+"!aA9",sector:sectors.find(x=>x.codigo==="INFRAESTRUTURA_URBANA").id,cat:"INFRAESTRUTURA_URBANA"}
    ];
    const demandIds=[randomUUID(),randomUUID()];
    const hashes=await Promise.all(users.map(x=>bcrypt.hash(x.pass,12)));
    attempted=true;
    await sql.begin(async tx=>{
      const present=await tx.unsafe("select (select count(*)::int from private.admins where email in ($1,$2)) as admins,(select count(*)::int from public.demandas where protocolo in ($3,$4)) as demandas",[...lab.emails,...lab.protocols]);
      if(!present.length || present[0].admins!==0 || present[0].demandas!==0)throw Error("COLISAO_FIXTURE");
      for(let i=0;i<users.length;i++){
        const u=users[i];
        await tx.unsafe("insert into private.admins(id,nome,email,password_hash,ativo,perfil_acesso,setor_id) values($1::uuid,$2,$3,$4,true,'ATENDENTE',$5::uuid)",[u.id,u.name,u.email,hashes[i],u.sector]);
        await tx.unsafe("insert into public.demandas(id,protocolo,nome_solicitante,municipio,bairro,categoria,tipo_problema,descricao,prioridade,status) values($1::uuid,$2,'QA FISCALIZE','Manaus','QA SINTETICO',$3,$4,$5,'BAIXA','RECEBIDA')",
          [demandIds[i],lab.protocols[i],u.cat,i===0?"UNIDADE_SAUDE":"BURACO_PAVIMENTACAO",lab.descriptions[i]]);
      }
    });
    console.log("QA_FIXTURES=CRIADAS");
    for(let i=0;i<users.length;i++){
      if(interrupted)throw Error("INTERRUPTED");
      const res=await call("/api/auth/admin/login",{method:"POST",json:{email:users[i].email,password:users[i].pass}});
      if(res.status!==200 || !res.cookie || !res.cookie.startsWith("token="))throw Error("LOGIN_FALHA");
      users[i].cookie=res.cookie;
      const ses=await call("/api/auth/session",{cookie:res.cookie});
      if(ses.status!==200 || ses.data?.authenticated!==true || ses.data?.user?.perfil_acesso!=="ATENDENTE")throw Error("SESSION_FALHA");
    }
    console.log("QA_LOGIN_SESSOES=OK");
    for(let i=0;i<users.length;i++){
      if(interrupted)throw Error("INTERRUPTED");
      const own=await call("/api/admin/demandas?protocolo="+encodeURIComponent("QA-"+run),{cookie:users[i].cookie});
      const items=own.data?.items;
      if(own.status!==200 || !Array.isArray(items) || items.length!==1 ||
        items[0].id!==demandIds[i] || items[0].categoria!==users[i].cat)throw Error("ESCOPO_LISTAGEM");
      const foreign=await call("/api/admin/demandas?categoria="+encodeURIComponent(users[1-i].cat),{cookie:users[i].cookie});
      if(foreign.status!==200 || foreign.data?.total!==0 || !Array.isArray(foreign.data?.items) || foreign.data.items.length)throw Error("ESCOPO_CATEGORIA");
      const block=await call("/api/admin/equipe",{cookie:users[i].cookie});
      if(block.status!==403)throw Error("EQUIPE_EXPOSTA");
      const cross=await call("/api/admin/demandas/"+demandIds[1-i]+"/status",{
        method:"PATCH",cookie:users[i].cookie,
        json:{status:"EM_TRIAGEM",expected_updated_at:own.data.items[0].updated_at}
      });
      if(cross.status!==404)throw Error("ALTERACAO_CRUZADA");
    }
    console.log("QA_ISOLAMENTO_LISTAGEM=OK");
    console.log("QA_BLOQUEIO_EQUIPE=OK");
    console.log("QA_ALTERACAO_CRUZADA=NEGADA");
    const first=await call("/api/admin/demandas?protocolo="+encodeURIComponent(lab.protocols[0]),{cookie:users[0].cookie});
    const t=first.data?.items?.[0];
    if(first.status!==200 || t?.id!==demandIds[0] || !t.updated_at)throw Error("VERSAO_INVALIDA");
    const ownChange=await call("/api/admin/demandas/"+demandIds[0]+"/status",{
      method:"PATCH",cookie:users[0].cookie,
      json:{status:"EM_TRIAGEM",expected_updated_at:t.updated_at}
    });
    if(ownChange.status!==200 || ownChange.data?.success!==true)throw Error("ALTERACAO_PROPRIA_FALHA");
    console.log("QA_ALTERACAO_PROPRIA=OK");
    // A desativacao da fixture testa a revalidacao persistida de JWT.
    await sql.unsafe("update private.admins set ativo=false where id=$1::uuid and email=$2 and perfil_acesso='ATENDENTE'",[users[0].id,users[0].email]);
    const revoked=await call("/api/admin/demandas",{cookie:users[0].cookie});
    if(revoked.status!==403)throw Error("REVOGACAO_FALHA");
    console.log("QA_REVOGACAO=OK");
    const logout=await call("/api/auth/logout",{method:"POST",cookie:users[1].cookie});
    if(logout.status!==200 || !logout.setCookie?.some(x=>x.startsWith("token=") && /Max-Age=0|Expires=/i.test(x)))throw Error("LOGOUT_COOKIE_FALHA");
    const absent=await call("/api/auth/session");
    if(absent.status!==401)throw Error("LOGOUT_SESSION_FALHA");
    console.log("QA_LOGOUT=OK");
    console.log("QA_TESTES=SUCCESS");
  }catch{
    failure=true;
    console.log("QA_TESTES=FALHA_OU_INCONCLUSIVO");
  }finally{
    if(execute && attempted){
      cleaned=await cleanup(sql,lab).catch(()=>false);
      console.log("QA_LIMPEZA="+(cleaned?"OK":"PENDENTE"));
    }
    await sql.end({timeout:5}).catch(()=>{});
    if(failure || ((execute||cleanupArg) && !cleaned))process.exitCode=2;
    console.log("QA_PRODUCAO=NAO_ACESSADA");
  }
}
async function call(path,options={}){
  const headers={Accept:"application/json"};
  if(options.cookie)headers.Cookie=options.cookie;
  if(options.method && options.method!=="GET")headers.Origin=ORIGIN;
  if(options.json)headers["Content-Type"]="application/json";
  const res=await fetch(ORIGIN+path,{
    method:options.method||"GET",headers,
    body:options.json?JSON.stringify(options.json):undefined,
    redirect:"error",signal:AbortSignal.timeout(13000)
  });
  let data=null;
  try{data=await res.json()}catch{}
  const setCookie=typeof res.headers.getSetCookie==="function"?res.headers.getSetCookie():[res.headers.get("set-cookie")].filter(Boolean);
  const token=setCookie.find(x=>x.startsWith("token="));
  return {status:res.status,data,cookie:token?.split(";")[0],setCookie};
}
async function cleanup(sql,lab){
  // Nunca limpar por "like", por intervalo ou por setor. Somente emails, protocolos e nomes QA exatos.
  return await sql.begin(async tx=>{
    const accounts=await tx.unsafe("select id,email from private.admins where email in ($1,$2) and perfil_acesso='ATENDENTE' and nome like 'QA FISCALIZE %' for update",lab.emails);
    const demands=await tx.unsafe("select id,protocolo,descricao from public.demandas where protocolo in ($1,$2) and nome_solicitante='QA FISCALIZE' for update",lab.protocols);
    if(accounts.length>2 || demands.length>2)throw Error("LIMPEZA_AMBIGUA");
    for(const d of demands)if(d.descricao!==lab.descriptions[lab.protocols.indexOf(d.protocolo)])throw Error("LIMPEZA_DEMANDA_MISMATCH");
    for(const a of accounts)if(!lab.emails.includes(a.email))throw Error("LIMPEZA_ADMIN_MISMATCH");
    for(const a of accounts){
      const ref=await tx.unsafe("select count(*)::int as total from private.field_registration_tickets where assessor_id=$1::uuid",[a.id]);
      if(ref[0]?.total!==0)throw Error("ADMIN_VINCULADO_TICKETS");
    }
    for(const d of demands)await tx.unsafe("delete from public.demandas where id=$1::uuid and protocolo=$2 and descricao=$3 and nome_solicitante='QA FISCALIZE'",[d.id,d.protocolo,d.descricao]);
    for(const a of accounts)await tx.unsafe("delete from private.admins where id=$1::uuid and email=$2 and perfil_acesso='ATENDENTE' and nome like 'QA FISCALIZE %'",[a.id,a.email]);
    const remains=await tx.unsafe("select (select count(*)::int from private.admins where email in ($1,$2)) as admins,(select count(*)::int from public.demandas where protocolo in ($3,$4)) as demandas",[...lab.emails,...lab.protocols]);
    if(remains[0].admins!==0 || remains[0].demandas!==0)throw Error("LIMPEZA_INCOMPLETA");
    // Logs de auditoria do teste sao mantidos para rastreabilidade.
    return true;
  });
}
