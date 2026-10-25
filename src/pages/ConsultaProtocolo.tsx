import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Copy, Info, MapPin, Radar, RefreshCw, Search, Share2, ShieldCheck, Tag, X } from "lucide-react";
import { demandCategoryLabel, demandProblemLabel } from "../shared/demandTaxonomy";

const statusLabel: Record<string, string> = {
  RECEBIDA: "Recebido",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADA: "Encaminhado",
  EM_ANALISE: "Em análise",
  EM_EXECUCAO: "Em andamento",
  CONCLUIDA: "Concluído",
  INDEFERIDA: "Encerrado",
};

const statusGuidance: Record<string, { title: string; text: string }> = {
  RECEBIDA: { title: "Registro recebido", text: "Seu registro foi recebido pelo FISCALIZE. Quando houver uma nova atualização no acompanhamento, ela aparecerá neste histórico." },
  EM_TRIAGEM: { title: "Em triagem", text: "O FISCALIZE está organizando o registro para acompanhamento. As mudanças ficam registradas no histórico." },
  ENCAMINHADA: { title: "Encaminhamento registrado", text: "Há um encaminhamento registrado no FISCALIZE. Isso não significa, por si só, protocolo ou aceite por um órgão público." },
  EM_ANALISE: { title: "Em análise", text: "O registro está em análise dentro do FISCALIZE. Novas atualizações aparecerão aqui." },
  EM_EXECUCAO: { title: "Em andamento", text: "O acompanhamento está marcado como em andamento no FISCALIZE. Consulte o histórico para ver novas atualizações." },
  CONCLUIDA: { title: "Marcado como concluído", text: "O acompanhamento no FISCALIZE foi marcado como concluído. Isso não substitui eventual confirmação do órgão responsável." },
  INDEFERIDA: { title: "Registro encerrado", text: "O acompanhamento no FISCALIZE foi encerrado. O histórico abaixo preserva as mudanças registradas." },
};

const dateOpts = { timeZone: "America/Manaus", day: "2-digit", month: "2-digit", year: "numeric" } as const;
const formatDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", dateOpts);
const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { ...dateOpts, hour: "2-digit", minute: "2-digit" });
const PROTOCOL_RE = /^AM-\d{8}-[A-F0-9]{6,32}$/;
const normalizeProtocolInput = (value: string) => value.toUpperCase().replace(/\s+/g, "").slice(0, 44);

export default function ConsultaProtocolo({ user }: { user?: any }) {
  const location = useLocation();
  const navigationState = location.state as { fromAccount?: boolean; fromSubmission?: boolean } | null;
  const fromAccount = Boolean(navigationState?.fromAccount);
  const fromSubmission = Boolean(navigationState?.fromSubmission);
  const isCitizen = user?.type === "cidadao";
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState(normalizeProtocolInput(params.get("codigo") || ""));
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState("");

  const guidance = useMemo(
    () => statusGuidance[resultado?.demanda?.status] || {
      title: statusLabel[resultado?.demanda?.status] || "Situação atual",
      text: "Consulte o histórico público abaixo para acompanhar as mudanças registradas no sistema.",
    },
    [resultado],
  );

  const latestUpdate = useMemo(() => {
    const history = Array.isArray(resultado?.historico) ? resultado.historico : [];
    return history.at(-1)?.created_at || resultado?.demanda?.updated_at || resultado?.demanda?.created_at || "";
  }, [resultado]);

  const historyNewestFirst = useMemo(() => {
    const history = Array.isArray(resultado?.historico) ? resultado.historico : [];
    return [...history].reverse();
  }, [resultado]);

  const consultar = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = normalizeProtocolInput(codigo);
    setCodigo(normalized);
    setError("");
    setActionFeedback("");

    if (!normalized) {
      setResultado(null);
      setError("Digite o protocolo para consultar o andamento.");
      return;
    }

    if (!PROTOCOL_RE.test(normalized)) {
      setResultado(null);
      setError("Revise o protocolo. Ele deve começar com AM-, seguido da data e do código recebido no registro.");
      return;
    }

    setLoading(true);
    setResultado(null);
    try {
      const response = await fetch(`/api/demandas/protocolo/${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Não foi possível consultar agora. Tente novamente.");
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Protocolo não encontrado.");
      setResultado(data);
    } catch (err: any) {
      setError(err?.message || "Não foi possível consultar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const clearProtocol = () => {
    setCodigo("");
    setResultado(null);
    setError("");
    setActionFeedback("");
  };

  const copyProtocol = async () => {
    const protocol = resultado?.demanda?.protocolo;
    if (!protocol) return;
    try {
      await navigator.clipboard.writeText(protocol);
      setActionFeedback("Protocolo copiado.");
    } catch {
      setActionFeedback("Não foi possível copiar automaticamente. Selecione o protocolo na tela.");
    }
  };

  const shareProtocol = async () => {
    const protocol = resultado?.demanda?.protocolo;
    if (!protocol) return;
    const url = `${window.location.origin}/protocolo?codigo=${encodeURIComponent(protocol)}&share=2`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Acompanhar protocolo FISCALIZE", text: `Protocolo ${protocol}`, url });
        setActionFeedback("Acompanhamento compartilhado.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setActionFeedback("Link de acompanhamento copiado.");
    } catch (err: any) {
      if (err?.name !== "AbortError") setActionFeedback("Não foi possível compartilhar agora.");
    }
  };

  useEffect(() => {
    if (params.get("codigo")) void consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-8">
      <section className="sm:grid sm:gap-7 lg:grid-cols-[1fr_0.72fr] lg:items-end">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5"><Radar className="h-4 w-4" /> FISCALIZE · Protocolo</span>
            <span className="hidden rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b84405] sm:inline-flex">Status e histórico</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl">Consultar protocolo</h1>
          <p className="mt-2 text-sm leading-6 text-[#657089] sm:mt-3 sm:text-base">Digite ou cole o código recebido após o envio para ver a situação atual e o histórico do registro.</p>
        </div>

        <div className="hidden grid-cols-3 gap-2 rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-4 sm:grid">
          {["Status atual", "Última atualização", "Histórico"].map((item, index) => (
            <div key={item} className="rounded-xl bg-white px-2 py-3 text-center shadow-sm">
              <span className="block text-[10px] font-extrabold text-[#f36a10]">0{index + 1}</span>
              <span className="mt-1 block text-xs font-bold text-[#526078] sm:text-sm">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={consultar} data-followup-search className="surface-card mt-5 overflow-hidden sm:mt-7">
        <div className="h-1.5 bg-[#f36a10]" />
        <div className="p-4 sm:flex sm:gap-3 sm:p-5">
          <div className="relative flex-1">
            <input
              value={codigo}
              onChange={(event) => setCodigo(normalizeProtocolInput(event.target.value))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Número do protocolo"
              placeholder="Ex.: AM-20260918-A1B2C3"
              className="field mt-0 min-h-14 w-full pr-12 font-mono text-base"
            />
            {codigo && (
              <button type="button" onClick={clearProtocol} aria-label="Limpar protocolo" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#7c879d] hover:bg-[#eef2fb]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button disabled={loading} className="primary-button mt-2.5 min-h-14 w-full justify-center px-6 text-base sm:mt-0 sm:w-auto">
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </div>
        <p className="px-4 pb-4 text-xs leading-5 text-[#657089] sm:px-5 sm:pb-5">Você não precisa entrar na conta. Use o código completo recebido após registrar o problema.</p>
      </form>

      {isCitizen && (
        <div data-account-followup-context className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-[#d7e0f2] bg-white px-3.5 py-3 text-xs leading-5 text-[#526078] sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-sm">
          <div className="min-w-0">
            <strong className="block text-[#172033]">{fromSubmission ? "Acompanhamento do registro enviado" : fromAccount ? "Acompanhamento aberto pela sua conta" : "Você está conectado"}</strong>
            <span>{fromSubmission ? "Consulte o andamento abaixo e depois volte à sua conta para acompanhar os registros vinculados." : fromAccount ? "Depois de consultar o histórico, você pode voltar à lista sem digitar o protocolo novamente." : "Seus registros vinculados ficam reunidos em Meus registros."}</span>
          </div>
          <Link to="/meus-registros" className="shrink-0 rounded-lg px-2 py-1.5 font-extrabold text-[#1f2e6e] hover:bg-[#eef2fb]">Meus registros</Link>
        </div>
      )}

      <div className="mt-3 flex gap-2 rounded-xl border border-[#d7e0f2] bg-[#eef2fb] px-3.5 py-3 text-xs leading-5 text-[#526078] sm:mt-4 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1f2e6e]" />
        <p><strong>Consulta pública protegida.</strong> Mostramos apenas dados necessários para o acompanhamento. Descrição, contato, fotos, endereço detalhado e observações internas não são exibidos.</p>
      </div>

      {error && (
        <div role="alert" data-followup-error className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-700">
          <p className="font-extrabold">{error.includes("não encontrado") ? "Protocolo não encontrado" : "Revise a consulta"}</p>
          <p className="mt-1 leading-6">{error.includes("não encontrado") ? "Confira se o código foi digitado por completo e tente novamente." : error}</p>
          <button type="button" onClick={() => { setError(""); window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Número do protocolo"]')?.focus(), 50); }} className="mt-2 min-h-11 text-sm font-extrabold text-[#1f2e6e]">Tentar novamente</button>
        </div>
      )}

      {resultado && (
        <>
          <section data-followup-status className="mt-5 rounded-2xl border border-[#d7e0f2] bg-white p-4 shadow-sm sm:mt-7 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="icon-tile shrink-0"><Info className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#ffd7bc] bg-[#fff0e5] px-3 py-1.5 text-xs font-extrabold text-[#b84405]"><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />{statusLabel[resultado.demanda.status] || resultado.demanda.status}</span>
                  {latestUpdate && <span className="text-xs font-semibold text-[#7c879d]">Última atualização: {formatDateTime(latestUpdate)}</span>}
                </div>
                <h2 className="mt-3 text-xl font-extrabold text-[#172033] sm:text-2xl">{guidance.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#657089] sm:leading-7">{guidance.text}</p><p className="mt-3 text-xs leading-5 text-[#7c879d]">O status mostrado pertence ao acompanhamento no FISCALIZE e não representa confirmação automática por órgão público.</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef2fb] pt-4">
              <p className="text-xs leading-5 text-[#657089]">O FISCALIZE não exibe prazo automático de solução.</p>
              <button type="button" onClick={() => void consultar()} disabled={loading} className="secondary-button min-h-11 shrink-0 justify-center px-3 text-xs sm:text-sm">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </button>
            </div>
          </section>

          <section data-followup-protocol className="mt-4 rounded-2xl border border-[#d7e0f2] bg-white p-4 shadow-sm sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7c879d]">Protocolo</p>
            <p className="mt-1 break-all font-mono text-lg font-extrabold text-[#1f2e6e] sm:text-2xl">{resultado.demanda.protocolo}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={copyProtocol} className="secondary-button min-h-12 justify-center px-4 text-sm"><Copy className="h-4 w-4" /> Copiar</button>
              <button type="button" onClick={shareProtocol} className="secondary-button min-h-12 justify-center px-4 text-sm"><Share2 className="h-4 w-4" /> Compartilhar</button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-[#1f2e6e]">{actionFeedback}</p>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
            <section data-followup-details className="surface-card p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#7c879d]">Registro</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#172033]">Detalhes públicos</h3>
                </div>
                <span className="icon-tile"><MapPin className="h-4 w-4" /></span>
              </div>

              <dl className="mt-4 divide-y divide-[#eef2fb] sm:hidden">
                {[
                  ["Município", resultado.demanda.municipio],
                  ["Área", demandCategoryLabel(resultado.demanda.categoria)],
                  ["Problema", demandProblemLabel(resultado.demanda.categoria, resultado.demanda.tipo_problema)],
                  ["Registrado", formatDate(resultado.demanda.created_at)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex min-h-12 items-center justify-between gap-4 py-2">
                    <dt className="text-xs font-bold text-[#657089]">{label}</dt>
                    <dd className="max-w-[62%] text-right text-sm font-extrabold text-[#34425b]">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2">
                {[
                  [MapPin, "Município", resultado.demanda.municipio],
                  [Tag, "Problema", demandProblemLabel(resultado.demanda.categoria, resultado.demanda.tipo_problema)],
                  [Tag, "Área", demandCategoryLabel(resultado.demanda.categoria)],
                  [Clock, "Registrado", formatDate(resultado.demanda.created_at)],
                ].map(([Icon, label, value]: any) => (
                  <div key={label} className="rounded-2xl bg-[#f7f9fd] p-4">
                    <Icon className="mb-2 h-4 w-4 text-[#1f2e6e]" />
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">{label}</span>
                    <span className="mt-1 block text-sm font-semibold text-[#34425b]">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section data-followup-history className="surface-card p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#f36a10]">Acompanhamento</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#172033]">Histórico · {resultado.historico.length} {resultado.historico.length === 1 ? "atualização" : "atualizações"}</h3><p className="mt-1 text-xs text-[#7c879d]">Atualização mais recente primeiro.</p>
                </div>
                <span className="icon-tile"><Radar className="h-4 w-4" /></span>
              </div>

              <div className="mt-5 space-y-5 sm:hidden">
                {historyNewestFirst.map((item: any, index: number) => (
                  <div key={`${item.status_novo}-${item.created_at}-mobile-${index}`} className="relative pl-6 before:absolute before:left-[7px] before:top-5 before:h-[calc(100%+0.5rem)] before:w-px before:bg-[#d7e0f2] last:before:hidden">
                    <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#f36a10] ring-1 ring-[#ffc79f]" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-extrabold text-[#172033]">{statusLabel[item.status_novo] || item.status_novo}</div>
                      <div className="shrink-0 text-xs text-[#7c879d]">{formatDateTime(item.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 hidden space-y-5 sm:block">
                {historyNewestFirst.map((item: any, index: number) => (
                  <div key={`${item.status_novo}-${item.created_at}-desktop-${index}`} className="relative pl-6 before:absolute before:left-[7px] before:top-5 before:h-[calc(100%+0.5rem)] before:w-px before:bg-[#d7e0f2] last:before:hidden">
                    <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#f36a10] ring-1 ring-[#ffc79f]" />
                    <div className="text-sm font-extrabold text-[#172033]">{statusLabel[item.status_novo] || item.status_novo}</div>
                    <div className="mt-0.5 text-xs text-[#7c879d]">{formatDateTime(item.created_at)}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-[#657089]">Compartilhar é opcional e inclui somente o link de acompanhamento do protocolo.</p>

          {isCitizen && (
            <section data-account-followup-return className="mt-4 rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-4 sm:p-5">
              <h3 className="text-base font-extrabold text-[#172033]">Continue pela sua conta</h3>
              <p className="mt-1 text-sm leading-6 text-[#657089]">Volte para ver os registros vinculados à sua conta e abrir outro acompanhamento sem digitar o protocolo.</p>
              <div className="mt-4 grid gap-2 sm:flex">
                <Link to="/meus-registros" className="primary-button min-h-12 justify-center px-5 text-sm">Voltar aos meus registros</Link>
                <Link to="/demandas/nova" className="secondary-button min-h-12 justify-center px-5 text-sm">Registrar outra ocorrência</Link>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
