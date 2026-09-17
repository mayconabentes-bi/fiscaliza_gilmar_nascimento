import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Clock, MapPin, Tag, Radar, CheckCircle2, ShieldCheck } from "lucide-react";

const statusLabel: Record<string, string> = {
  RECEBIDA: "Recebido",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADA: "Encaminhado",
  EM_ANALISE: "Em análise",
  EM_EXECUCAO: "Em andamento",
  CONCLUIDA: "Concluído",
  INDEFERIDA: "Encerrado"
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", {
  timeZone: "America/Manaus",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR", {
  timeZone: "America/Manaus",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

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
      const response = await fetch(`/api/demandas/protocolo/${encodeURIComponent(codigo.trim())}`, { cache: "no-store" });
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
      <section className="grid gap-7 lg:grid-cols-[1fr_0.72fr] lg:items-end">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5"><Radar className="h-4 w-4" /> FISCALIZE · Acompanhar</span>
            <span className="inline-flex rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b84405]">Seu protocolo, seu histórico</span>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Veja o andamento do seu registro.</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#657089] sm:text-base">Digite o protocolo recebido no envio para consultar status, datas e as mudanças registradas no histórico público do caso.</p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-3 sm:p-4">
          {["Status", "Datas", "Histórico"].map((item, index) => <div key={item} className="rounded-xl bg-white px-2 py-3 text-center shadow-sm"><span className="block text-[10px] font-extrabold text-[#f36a10]">0{index + 1}</span><span className="mt-1 block text-xs font-bold text-[#526078] sm:text-sm">{item}</span></div>)}
        </div>
      </section>

      <div className="mt-6 flex gap-3 rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-4 text-xs leading-relaxed text-[#526078] sm:text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1f2e6e]" /><p>A consulta pública mostra apenas protocolo, município, categoria, status, datas e histórico de status. Descrição, contato, foto e observações internas não são exibidos aqui.</p></div>

      <form onSubmit={consultar} className="surface-card mt-7 overflow-hidden">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="grid gap-3 p-4 sm:flex sm:p-5">
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: AM-20260917-A1B2C3" autoCapitalize="characters" spellCheck={false} aria-label="Número do protocolo" className="field mt-0 min-h-14 flex-1 font-mono" />
          <button disabled={loading} className="primary-button min-h-14 px-6 text-base"><Search className="h-5 w-5" /> {loading ? "Buscando..." : "Ver andamento"}</button>
        </div>
      </form>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{error}</div>}

      {resultado && (
        <div className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="surface-card overflow-hidden">
            <div className="h-1 bg-[#1f2e6e]" aria-hidden="true" />
            <div className="p-5 sm:p-7">
              <div className="flex flex-col gap-4 border-b border-[#edf0f6] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7c879d]">Seu protocolo</span><h2 className="mt-1 break-all font-mono text-xl font-bold text-[#1f2e6e] sm:text-2xl">{resultado.demanda.protocolo}</h2></div>
                <span className="inline-flex self-start items-center gap-2 rounded-full border border-[#ffd7bc] bg-[#fff0e5] px-3 py-1.5 text-sm font-extrabold text-[#b84405]"><CheckCircle2 className="h-4 w-4" />{statusLabel[resultado.demanda.status] || resultado.demanda.status}</span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#f7f9fd] p-4"><MapPin className="mb-2 h-4 w-4 text-[#1f2e6e]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Município</span><span className="mt-1 block text-sm font-semibold text-[#34425b]">{resultado.demanda.municipio}</span></div>
                <div className="rounded-2xl bg-[#f7f9fd] p-4"><Tag className="mb-2 h-4 w-4 text-[#1f2e6e]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Categoria</span><span className="mt-1 block text-sm font-semibold text-[#34425b]">{resultado.demanda.categoria}</span></div>
                <div className="rounded-2xl bg-[#f7f9fd] p-4"><Clock className="mb-2 h-4 w-4 text-[#1f2e6e]" /><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Registrado</span><span className="mt-1 block text-sm font-semibold text-[#34425b]">{formatDate(resultado.demanda.created_at)}</span></div>
              </div>
            </div>
          </section>

          <aside className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#f36a10]">Acompanhamento</p><h3 className="mt-1 text-lg font-extrabold text-[#172033]">Histórico público</h3></div><span className="icon-tile"><Radar className="h-4 w-4" /></span></div>
            <p className="mt-2 text-xs leading-relaxed text-[#657089]">As mudanças de status ficam registradas em ordem cronológica.</p>
            <div className="mt-5 space-y-5">
              {resultado.historico.map((item: any, index: number) => (
                <div key={index} className="relative pl-6 before:absolute before:left-[7px] before:top-5 before:h-[calc(100%+0.5rem)] before:w-px before:bg-[#d7e0f2] last:before:hidden">
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#f36a10] ring-1 ring-[#ffc79f]" />
                  <div className="text-sm font-extrabold text-[#172033]">{statusLabel[item.status_novo] || item.status_novo}</div>
                  <div className="mt-0.5 text-xs text-[#7c879d]">{formatDateTime(item.created_at)}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
