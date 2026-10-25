import { useEffect, useState } from "react";
import { X, Send, RefreshCw } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

type Forwarding = {
 id:string; destinatario:string; canal:string; resumo:string; situacao:string;
 referencia_externa:string|null; retorno_publico:string|null;
 proxima_verificacao:string|null; created_at:string;
};
const channels=["OUVIDORIA","PORTAL","EMAIL","PRESENCIAL","OFICIO","OUTRO"];
const steps=["PREPARADO","ENVIADO","PROTOCOLADO","AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"];
const permitted:Record<string,string[]>={
 PREPARADO:["ENVIADO","PROTOCOLADO","ENCERRADO"], ENVIADO:["PROTOCOLADO","AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"],
 PROTOCOLADO:["AGUARDANDO_RESPOSTA","RESPONDIDO","ENCERRADO"], AGUARDANDO_RESPOSTA:["RESPONDIDO","ENCERRADO"],
 RESPONDIDO:["AGUARDANDO_RESPOSTA","ENCERRADO"], ENCERRADO:[]
};
async function jsonRequest(path:string, options:RequestInit={}) {
 const response=await fetchWithTimeout(path,{credentials:"same-origin",cache:"no-store",...options},12000);
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||"Operação indisponível.");
 return data;
}
export default function EncaminhamentosCivicos({demanda,onClose}:{demanda:any;onClose:()=>void}) {
 const [items,setItems]=useState<Forwarding[]>([]);
 const [destinatario,setDestinatario]=useState("");
 const [canal,setCanal]=useState("OUVIDORIA");
 const [resumo,setResumo]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [situacao,setSituacao]=useState("PREPARADO");
 const [referencia,setReferencia]=useState("");
 const [retorno,setRetorno]=useState("");
 const [proxima,setProxima]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const reload=async()=>{const result=await jsonRequest(`/api/admin/demandas/${demanda.id}/encaminhamentos`);setItems(result.items||[]);};
 useEffect(()=>{let active=true;jsonRequest(`/api/admin/demandas/${demanda.id}/encaminhamentos`).then(v=>{if(active)setItems(v.items||[]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[demanda.id]);
 const create=async()=>{
  setBusy(true);setError("");setNotice("");
  try {await jsonRequest(`/api/admin/demandas/${demanda.id}/encaminhamentos`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({destinatario,canal,resumo})});await reload();setDestinatario("");setResumo("");setNotice("Encaminhamento preparado. Nenhum envio externo foi realizado.");}
  catch(e:any){setError(e.message);}finally{setBusy(false);}
 };
 const edit=(item:Forwarding)=>{setEditing(item.id);setSituacao(item.situacao);setReferencia(item.referencia_externa||"");setRetorno(item.retorno_publico||"");setProxima(item.proxima_verificacao?new Date(item.proxima_verificacao).toISOString().slice(0,10):"");setError("");};
 const save=async()=>{
  setBusy(true);setError("");setNotice("");
  try{await jsonRequest(`/api/admin/encaminhamentos/${editing}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({situacao,referencia_externa:referencia,retorno_publico:retorno,proxima_verificacao:proxima?new Date(`${proxima}T12:00:00-04:00`).toISOString():null})});await reload();setEditing(null);setNotice("Acompanhamento atualizado na central privada.");}
  catch(e:any){setError(e.message);}finally{setBusy(false);}
 };
 return <div role="dialog" aria-modal="true" aria-labelledby="civic-forward-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-5">
  <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
   <div className="flex items-start justify-between gap-3"><div><h2 id="civic-forward-title" className="text-xl font-extrabold">Encaminhamentos cívicos</h2><p className="mt-1 text-sm text-slate-600">{demanda.protocolo} · {demanda.bairro||"Manaus"}</p></div><button aria-label="Fechar encaminhamentos" onClick={onClose} className="rounded-lg p-3"><X/></button></div>
   <p className="my-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Área privada do projeto cívico independente. O registro nesta tela não constitui protocolo oficial; informe a referência recebida da órgão destinatário após o envio externo.</p>
   {error&&<p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
   <section className="space-y-3 rounded-2xl border border-slate-200 p-4"><h3 className="font-bold">Preparar encaminhamento</h3>
    <label className="block text-sm font-semibold">Órgão ou destinatário<input className="field mt-1 w-full" value={destinatario} maxLength={180} onChange={e=>setDestinatario(e.target.value)} placeholder="Ex.: Ouvidoria do órgão competente"/></label>
    <label className="block text-sm font-semibold">Canal<select className="field mt-1 w-full" value={canal} onChange={e=>setCanal(e.target.value)}>{channels.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label className="block text-sm font-semibold">Resumo da solicitação<textarea className="field mt-1 w-full" rows={3} maxLength={2000} value={resumo} onChange={e=>setResumo(e.target.value)}/></label>
    <button type="button" disabled={busy||!destinatario.trim()||!resumo.trim()} onClick={create} className="primary-button min-h-12 w-full justify-center"><Send className="h-4 w-4"/>Salvar preparação</button>
   </section>
   <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Histórico de encaminhamentos</h3><button disabled={busy} onClick={()=>void reload().catch(e=>setError(e.message))} className="secondary-button min-h-11 px-3"><RefreshCw className="h-4 w-4"/> Atualizar</button></div>
   {items.length===0?<p className="text-sm text-slate-500">Ainda não há encaminhamentos preparados.</p>:items.map(item=><article key={item.id} className="mb-3 rounded-xl border border-slate-200 p-4 text-sm">
    <p className="font-bold">{item.destinatario}</p><p className="mt-1 text-slate-600">{item.canal} · {item.situacao}</p><p className="mt-2 whitespace-pre-wrap">{item.resumo}</p>{item.referencia_externa&&<p className="mt-2 font-mono text-xs">Referência externa: {item.referencia_externa}</p>}
    <button type="button" onClick={()=>edit(item)} className="secondary-button mt-3 min-h-11 px-4">Atualizar acompanhamento</button>
    {editing===item.id&&<div className="mt-3 space-y-3 border-t pt-3">
     <label className="block font-semibold">Situação<select className="field mt-1 w-full" value={situacao} onChange={e=>setSituacao(e.target.value)}>{[item.situacao,...permitted[item.situacao]].map(s=><option key={s} value={s}>{steps.includes(s)?s:""}</option>)}</select></label>
     <label className="block font-semibold">Protocolo externo<input className="field mt-1 w-full" maxLength={160} value={referencia} onChange={e=>setReferencia(e.target.value)}/></label>
     <label className="block font-semibold">Resposta da órgão destinatário (registro privado)<textarea className="field mt-1 w-full" rows={3} maxLength={2000} value={retorno} onChange={e=>setRetorno(e.target.value)}/></label>
     <label className="block font-semibold">Próxima verificação<input className="field mt-1 w-full" type="date" value={proxima} onChange={e=>setProxima(e.target.value)}/></label>
     <div className="flex gap-2"><button disabled={busy|| (situacao==="PROTOCOLADO"&&!referencia.trim())} onClick={save} className="primary-button min-h-11">Salvar acompanhamento</button><button onClick={()=>setEditing(null)} className="secondary-button min-h-11">Cancelar</button></div>
    </div>}
   </article>)}</section>
  </div>
 </div>;
}
