import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Clock, MapPin, Tag, Radar, CheckCircle2 } from "lucide-react";

const statusLabel: Record<string, string> = {
  RECEBIDA: "Recebido",
  EM_TRIAGEM: "Em análise",
  ENCAMINHADA: "Encaminhado",
  EM_ANALISE: "Em análise",
  EM_EXECUCAO: "Em andamento",
  CONCLUIDA: "Concluído",
  INDEFERIDA: "Encerrado"
};

export default function ConsultaProtocolo() {
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState(params.get("codigo") || "");
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const consultar = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const response = await fetch(`/api/demandas/protocolo/${encodeURIComponent(codigo.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não encontramos esse protocolo.");
      setResultado(data);
    } catch (err: any) {
      setError(err.message || "Não foi possível consultar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("codigo")) consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-8">
      <div className="max-w-2xl">
        <span className="section-kicker"><Radar className="h-4 w-4" /> Acompanhamento</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#0b1f33] sm:text-4xl">Acompanhe seu registro.</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">Digite o protocolo recebido no envio para consultar o status e o histórico do caso.</p>
      </div>

      <form onSubmit={consultar} className="surface-card mt-7 grid gap-3 p-4 sm:flex sm:p-5">
        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: AM-20260705-A1B2C3" autoCapitalize="characters" spellCheck={false} aria-label="Número do protocolo" className="field mt-0 min-h-14 flex-1 font-mono" />
        <button disabled={loading} className="primary-button min-h-14 px-6 text-base"><Search className="h-5 w-5" /> {loading ? "Buscando..." : "Ver andamento"}</button>
      </form>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{error}</div>}

      {resultado && (
        <div className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="surface-card p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Seu protocolo</span><h2 className="mt-1 break-all font-mono text-xl font-bold text-[#0b1f33] sm:text-2xl">{resultado.demanda.protocolo}</h2></div>
              <span className="inline-flex self-start items-center gap-2 rounded-full border border-[#cfeee2] bg-[#eaf8f3] px-3 py-1.5 text-sm font-extrabold text-[#0f766e]"><CheckCircle2 className="h-4 w-4" />{statusLabel[resultado.demanda.status] || resultado.demanda.status}</span>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 sm:text-base">{resultado.demanda.descricao}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f6f9fb] p-4"><MapPin className="mb-2 h-4 w-4 text-[#1b5f8f]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Local</span><span className="mt-1 block text-sm font-semibold text-slate-700">{resultado.demanda.municipio} {resultado.demanda.bairro ? `- ${resultado.demanda.bairro}` : ""}</span></div>
              <div className="rounded-2xl bg-[#f6f9fb] p-4"><Tag className="mb-2 h-4 w-4 text-[#1b5f8f]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Categoria</span><span className="mt-1 block text-sm font-semibold text-slate-700">{resultado.demanda.categoria}</span></div>
              <div className="rounded-2xl bg-[#f6f9fb] p-4"><Clock className="mb-2 h-4 w-4 text-[#1b5f8f]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Registrado</span><span className="mt-1 block text-sm font-semibold text-slate-700">{new Date(resultado.demanda.created_at).toLocaleDateString()}</span></div>
            </div>
          </section>

          <aside className="surface-card p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-[#0b1f33]">Histórico</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">As atualizações ficam registradas em ordem cronológica.</p>
            <div className="mt-5 space-y-5">
              {resultado.historico.map((item: any, index: number) => (
                <div key={index} className="relative pl-6 before:absolute before:left-[7px] before:top-5 before:h-[calc(100%+0.5rem)] before:w-px before:bg-slate-200 last:before:hidden">
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#15956f] ring-1 ring-[#9bd7c3]" />
                  <div className="text-sm font-extrabold text-[#0b1f33]">{statusLabel[item.status_novo] || item.status_novo}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</div>
                  {item.observacao && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.observacao}</p>}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
