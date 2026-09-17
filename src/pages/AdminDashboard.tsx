import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, FileText, ShieldCheck, XCircle } from "lucide-react";

export default function AdminDashboard() {
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [denuncias, setDenuncias] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true); setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/admin/moderacao/pendentes", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/denuncias", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/auditoria/logs?limit=20", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (responses.some((res) => res.status === 401 || res.status === 403)) throw new Error("Acesso privado não autorizado.");
      if (responses.some((res) => !res.ok)) throw new Error("Não foi possível carregar a governança interna.");
      const [pendentesData, denunciasData, logsData] = await Promise.all(responses.map((res) => res.json()));
      setPendentes(Array.isArray(pendentesData) ? pendentesData : []);
      setDenuncias(Array.isArray(denunciasData) ? denunciasData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err: any) { setError(err.message || "Falha ao carregar dados."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleModeracao = async (id: string, decisao: string) => {
    const justificativa = prompt("Justificativa para a decisão:");
    if (!justificativa) return;
    const res = await fetch("/api/admin/moderacao/decisao", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicacaoId: id, decisao, justificativa }) });
    if (!res.ok) return alert("Não foi possível registrar a decisão.");
    fetchData();
  };

  const handleDenuncia = async (id: string, acao: string) => {
    const res = await fetch(`/api/admin/denuncias/${id}/resolver`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao }) });
    if (!res.ok) return alert("Não foi possível resolver a denúncia.");
    fetchData();
  };

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#657089]">Carregando governança privada...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-2 sm:py-6">
      <header className="surface-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f2e6e] via-[#1f2e6e] to-[#f36a10]" aria-hidden="true" />
        <div className="section-kicker"><ShieldCheck className="h-4 w-4" /> FISCALIZE · Governança</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#18255c]">Governança e moderação</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#657089]">Controles internos para revisar conteúdo, tratar denúncias e acompanhar ações administrativas com rastreabilidade.</p>
      </header>
      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card overflow-hidden"><div className="border-b border-[#dde4ef] px-6 py-4"><h2 className="flex items-center gap-2 font-extrabold text-[#172033]"><FileText className="h-5 w-5 text-amber-500" /> Moderação pendente ({pendentes.length})</h2></div><div className="divide-y divide-[#eef2fb] p-6">{pendentes.length === 0 ? <p className="py-4 text-center text-sm text-[#657089]">Nenhuma publicação pendente.</p> : pendentes.map((pub) => <div key={pub.id} className="py-4 first:pt-0"><div className="flex justify-between gap-3 text-xs text-[#7b8599]"><span>{pub.tipo_participacao}</span><span>{new Date(pub.created_at).toLocaleDateString()}</span></div><p className="my-3 text-sm text-[#34425b]">{pub.conteudo}</p><div className="flex gap-2"><button onClick={() => handleModeracao(pub.id, "APROVADA")} className="secondary-button flex-1"><CheckCircle className="h-4 w-4" /> Aprovar</button><button onClick={() => handleModeracao(pub.id, "REJEITADA")} className="secondary-button flex-1"><XCircle className="h-4 w-4" /> Rejeitar</button></div></div>)}</div></section>

        <section className="surface-card overflow-hidden"><div className="border-b border-[#dde4ef] px-6 py-4"><h2 className="flex items-center gap-2 font-extrabold text-[#172033]"><AlertTriangle className="h-5 w-5 text-red-500" /> Denúncias pendentes ({denuncias.length})</h2></div><div className="divide-y divide-[#eef2fb] p-6">{denuncias.length === 0 ? <p className="py-4 text-center text-sm text-[#657089]">Nenhuma denúncia pendente.</p> : denuncias.map((den) => <div key={den.id} className="py-4 first:pt-0"><p className="text-sm font-bold text-[#34425b]">{den.motivo}</p><p className="mt-2 text-sm text-[#657089]">{den.publicacao_conteudo}</p><div className="mt-3 flex gap-2"><button onClick={() => handleDenuncia(den.id, "REMOVER")} className="secondary-button flex-1">Remover</button><button onClick={() => handleDenuncia(den.id, "MANTER")} className="secondary-button flex-1">Manter</button></div></div>)}</div></section>
      </div>

      <section className="surface-card p-6"><h2 className="font-extrabold text-[#172033]">Atividade administrativa recente</h2><div className="mt-4 space-y-3">{logs.length === 0 ? <p className="text-sm text-[#657089]">Nenhuma ação registrada.</p> : logs.map((log) => <div key={log.id} className="rounded-xl border border-[#eef2fb] bg-[#fbfcff] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-[#34425b]">{log.acao}</span><span className="text-xs text-[#7b8599]">{new Date(log.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-[#657089]">{log.entidade} · {String(log.entidade_id).slice(0, 8)}</p></div>)}</div></section>
    </div>
  );
}
