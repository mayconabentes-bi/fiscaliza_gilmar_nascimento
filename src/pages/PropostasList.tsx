import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, CheckCircle, Clock, FileText, MapPin, Plus, Tag, ThumbsUp, TrendingUp } from "lucide-react";

export default function PropostasList() {
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch { localStorage.removeItem("user"); }
    }
    fetch("/api/propostas")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setPropostas(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PUBLICADA": return "bg-blue-100 text-blue-800";
      case "EM_ANALISE": return "bg-amber-100 text-amber-800";
      case "IMPLEMENTADA": return "bg-green-100 text-green-800";
      case "ARQUIVADA": return "bg-slate-100 text-slate-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#69736d]">Carregando propostas...</div>;

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><FileText className="h-8 w-8 text-emerald-600" /> Propostas cívicas</h1><p className="mt-2 text-slate-600">Soluções estruturadas publicadas por cidadãos.</p></div>
        {user?.type === "cidadao" && <Link to="/propostas/nova" className="primary-button min-h-11 px-4"><Plus className="h-5 w-5" /> Nova proposta</Link>}
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total", propostas.length, FileText],
          ["Em análise", propostas.filter((p) => p.status === "EM_ANALISE").length, Clock],
          ["Implementadas", propostas.filter((p) => p.status === "IMPLEMENTADA").length, CheckCircle],
          ["Arquivadas", propostas.filter((p) => p.status === "ARQUIVADA").length, Archive],
        ].map(([label, value, Icon]: any) => <div key={label} className="surface-card p-5"><Icon className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-2xl font-extrabold">{value}</p><p className="mt-1 text-sm text-[#69736d]">{label}</p></div>)}
      </div>

      <div className="grid gap-4">
        {propostas.length === 0 ? <div className="surface-card p-12 text-center"><FileText className="mx-auto h-12 w-12 text-slate-300" /><h2 className="mt-4 text-lg font-bold">Nenhuma proposta encontrada</h2><p className="mt-2 text-sm text-slate-500">Ainda não há propostas publicadas.</p></div> : propostas.map((proposta) => <Link key={proposta.id} to={`/propostas/${proposta.id}`} className="surface-card block p-6 transition hover:shadow-md"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(proposta.status)}`}>{String(proposta.status || "ABERTA").replaceAll("_", " ")}</span><span className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{proposta.municipio}</span><span className="flex items-center gap-1 text-sm text-slate-500"><Tag className="h-4 w-4" />{String(proposta.area_tematica || "").replaceAll("_", " ")}</span></div><span className="flex items-center gap-1 text-sm font-bold text-emerald-700"><TrendingUp className="h-4 w-4" /> Score {Number(proposta.score_prioridade || 0).toFixed(1)}</span></div><h2 className="mt-4 text-xl font-extrabold text-slate-900">{proposta.problema_resumido}</h2><p className="mt-2 line-clamp-2 text-slate-600">{proposta.proposta_solucao}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500"><span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{proposta.nivel_apoio || 0} apoios</span><span>Ver detalhes →</span></div></Link>)}
      </div>
    </div>
  );
}
