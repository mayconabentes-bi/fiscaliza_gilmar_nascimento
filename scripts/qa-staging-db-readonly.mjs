#!/usr/bin/env node
// Apenas SELECT: não imprime credenciais, e-mails, UUIDs ou dados de usuários.
import postgres from "postgres";
const expectedRef="zqxouixpokuprqqscnwf";
const safeEnv=process.env.RAILWAY_PROJECT_ID==="acd59c0a-4723-4162-9bfc-33bab1f096b0" &&
process.env.RAILWAY_ENVIRONMENT_ID==="32940765-7ef3-41c1-a017-48ad13120d65" &&
process.env.RAILWAY_SERVICE_ID==="98959349-60d9-4363-b7c3-e20e04e93a71" &&
process.env.RAILWAY_ENVIRONMENT_NAME==="homologacao";
function validDb(raw) {
 try {
  const u=new URL(raw);
  if(!["postgres:","postgresql:"].includes(u.protocol))return false;
  const host=u.hostname.toLowerCase(),user=decodeURIComponent(u.username).toLowerCase();
  return host==="db."+expectedRef+".supabase.co" && (user==="postgres"||user==="postgres."+expectedRef) ||
  /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host) && user==="postgres."+expectedRef;
 } catch{return false;}
}
if(!safeEnv || !validDb(process.env.DATABASE_URL||"") ||
process.env.SUPABASE_URL!=="https://"+expectedRef+".supabase.co") {
 console.log("QA_DB_GUARD=BLOQUEADO");process.exit(2);
}
console.log("QA_DB_GUARD=OK");
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:"require",connect_timeout:5,idle_timeout:1,max_lifetime:20});
try {
 const result=await sql.unsafe("SELECT (SELECT COUNT(*)::integer FROM private.admins) AS admins, (SELECT COUNT(*)::integer FROM private.setores) AS setores, (SELECT COUNT(*)::integer FROM private.setor_categorias) AS categorias, (SELECT COUNT(*)::integer FROM public.demandas) AS demandas");
 const row=result[0];
 if(!row)throw new Error("NO_ROW");
 console.log("QA_DB_CONEXAO=OK");
 for(const name of ["admins","setores","categorias","demandas"]){
  const value=row[name];
  console.log("QA_DB_"+name.toUpperCase()+"="+(Number.isSafeInteger(value)&&value>=0?value:"INCONCLUSIVO"));
 }
 console.log("QA_DB_FIXTURES_ESCRITA=NAO_AUTORIZADA");
} catch {
 console.log("QA_DB_CONEXAO=INCONCLUSIVO");
 console.log("QA_DB_FIXTURES_ESCRITA=NAO_AUTORIZADA");
 process.exitCode=2;
} finally {await sql.end({timeout:2}).catch(()=>{});}
