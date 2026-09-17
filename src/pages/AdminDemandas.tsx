import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

const statusOptions = [
  { value: "RECEBIDA", label: "Recebida", description: "Registro recebido e protocolado, aguardando triagem." },
  { value: "EM_TRIAGEM", label: "Em triagem", description: "Registro em avaliação inicial para classificação e priorização." },
  { value: "ENCAMINHADA", label: "Encaminhada", description: "Demanda encaminhada para a área responsável ou fluxo competente." },
  { value: "EM_ANALISE", label: "Em análise", description: "Equipe responsável está analisando o caso e os próximos passos." },
  { value: "EM_EXECUCAO", label: "Em execução", description: "Providências relacionadas à demanda estão em andamento." },
  { value: "CONCLUIDA", label: "Concluída", description: "Tratamento encerrado com providência ou resposta registrada." },
  { value: "INDEFERIDA", label: "Indeferida", description: "Demanda encerrada sem prosseguimento, com justificativa registrada." }
] as const;

type StatusValue = typeof statusOptions[number]["value"];

const prioridadeClass: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-blue-50 text-blue-700",
  ALTA: "bg-amber-50 text-amber-700",
  CRITICA: "bg-red-50 text-red-700"
};

function statusLabel(value: string) {
  return statusOptions.find(option => option.value === value)?.label || value;
}

export default function AdminDemandas() {
  const [demandas, setDemandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [error, setError] = useState("");
  const [demandaSelecionada, setDemandaSelecionada] = useState<any | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusValue>("RECEBIDA");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalError, setModalError] = useState("");
  const listControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const statusAtualLabel = useMemo(
    () => demandaSelecionada ? statusLabel(demandaSelecionada.status) : "",
    [demandaSelecionada]
  );

  const fetchDemandas = async () => {
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;

    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (municipio) params.set("municipio", municipio);
    if (categoria) params.set("categoria", categoria);

    try {
      const response = await fetchWithTimeout(
        `/api/admin/demandas?${params.toString()}`,
        { signal: controller.signal, cache: "no-store", credentials: "same-origin" },
        10000
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar demandas.");
      if (mountedRef.current && !controller.signal.aborted) setDemandas(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
      if (mountedRef.current) setError(err.message || "Erro ao carregar demandas.");
    } finally {
      if (mountedRef.current && listControllerRef.current === controller) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchDemandas();
    return () => {
      mountedRef.current = false;
      listControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirAlteracaoStatus = (demanda: any) => {
    setDemandaSelecionada(demanda);
    setNovoStatus((statusOptions.some(option => option.value === demanda.status) ? demanda.status : "RECEBIDA") as StatusValue);
    setObservacao("");
    setModalError("");
  };

  const fecharModal = () => {
    if (salvando) return;
    setDemandaSelecionada(null);
    setObservacao("");
    setModalError("");
  };

  const atualizarStatus = async () => {
    if (!demandaSelecionada) return;
    if (novoStatus === demandaSelecionada.status) {
      setModalError("Escolha um status diferente do atual.");
      return;
    }

    setSalvando(true);
    setModalError("");
    try {
      const response = await fetchWithTimeout(`/api/admin/demandas/${demandaSelecionada.id}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, observacao_interna: observacao.trim() })
      }, 12000);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar demanda.");
      setDemandaSelecionada(null);
      setObservacao("");
      await fetchDemandas();
    } catch (err: any) {
      setModalError(err?.name === "AbortError" ? "A atualização demorou além do esperado. Tente novamente." : (err.message || "Erro ao atualizar demanda."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600" /> Triagem de demandas
          </h1>
          <p className="mt-2 text-slate-600">Painel operacional para priorização, encaminhamento e atualização de status.</p>
        </div>
        <button onClick={fetchDemandas} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 shadow-sm">
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Filtrar município" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Filtrar categoria" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={fetchDemandas} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">Aplicar filtros</button>
      </div>

      {error && <div className="mb-6 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Protocolo</th>
                <th className="px-4 py-3 font-semibold">Território</th>
                <th className="px-4 py-3 font-semibold">Categoria</th>
                <th className="px-4 py-3 font-semibold">Prioridade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Carregando demandas...</td></tr>
              ) : demandas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhuma demanda encontrada.</td></tr>
              ) : demandas.map(demanda => (
                <tr key={demanda.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-4 font-mono font-semibold text-slate-900">{demanda.protocolo}</td>
                  <td className="px-4 py-4 text-slate-700">{demanda.municipio}<br /><span className="text-xs text-slate-400">{demanda.bairro || "Sem bairro"}</span></td>
                  <td className="px-4 py-4 text-slate-700">{demanda.categoria}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${prioridadeClass[demanda.prioridade] || prioridadeClass.MEDIA}`}>{demanda.prioridade}</span></td>
                  <td className="px-4 py-4 text-slate-700 font-semibold">{statusLabel(demanda.status)}</td>
                  <td className="px-4 py-4 text-slate-600 max-w-md line-clamp-3">{demanda.descricao}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => abrirAlteracaoStatus(demanda)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Alterar status</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {demandaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="status-modal-title">
          <div className="w-full max-w-2xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Atualização de andamento</p>
                <h2 id="status-modal-title" className="mt-1 text-xl font-extrabold text-slate-900">Alterar status da demanda</h2>
                <p className="mt-1 text-sm text-slate-500">{demandaSelecionada.protocolo} · status atual: <strong>{statusAtualLabel}</strong></p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-2">
                {statusOptions.map(option => {
                  const selected = novoStatus === option.value;
                  const current = demandaSelecionada.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNovoStatus(option.value)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                          {selected && <CheckCircle2 className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900">{option.label}</span>
                            {current && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">Atual</span>}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">{option.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-bold text-slate-800">Observação interna</span>
                <span className="mt-1 block text-xs text-slate-500">Registre um contexto curto sobre a mudança. Essa informação apoia a rastreabilidade administrativa.</span>
                <textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Ex.: Demanda validada e encaminhada para análise da equipe responsável."
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-right text-xs text-slate-400">{observacao.length}/2000</span>
              </label>

              {modalError && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{modalError}</div>}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={fecharModal} disabled={salvando} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={atualizarStatus} disabled={salvando || novoStatus === demandaSelecionada.status} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                {salvando ? "Salvando..." : `Confirmar: ${statusLabel(novoStatus)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
