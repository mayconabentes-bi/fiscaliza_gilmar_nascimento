import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Database, GraduationCap, HeartPulse, MapPinned, RefreshCw, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";
import { demandCategoryLabel, demandProblemLabel } from "../shared/demandTaxonomy";

type AgeIntelligenceBand = {
  codigo: string;
  label: string;
  total: number | null;
  percentual: number | null;
  suprimido: boolean;
};

type DemografiaEtaria = {
  total: number;
  classificados: number;
  naoInformados: number;
  detalhados: number;
  coberturaPercentual: number;
  coberturaDetalhadaPercentual: number;
  limiarMinimo: number;
  diversidadeGeracional: number | null;
  faixas: AgeIntelligenceBand[];
  metodologia: string;
};

type Resumo = {
  municipio: string;
  geradoEm: string;
  indicadores: { bairros: number | null; obras: number | null; unidadesSaude: number | null; escolasMunicipais: number | null; demandasRegistradas: number };
  demandasPorBairro: Array<{ bairro: string; total: number }>;
  demandasPorTema: Array<{ categoria: string; total: number }>;
  demandasPorTipo: Array<{ categoria: string; tipo_problema: string; total: number }>;
  demografiaEtaria?: DemografiaEtaria;
  disponibilidade: Array<{ name: string; available: boolean; error?: string | null }>;
  fontesExternas: Array<{ key: string; etapa: string; nome: string; status: string; endpoint?: string | null }>;
};

type Fonte = { key: string; etapa: string; nome: string; status: string; endpoint?: string | null; paginaOficial?: string };
type MapFeature = { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } };
type MapaResponse = { total: number; retornados: number; truncated: boolean; features: MapFeature[] };
type Territorio = { bairro: string; demandas: number; prioritarias: number; concluidas: number; temas: number; taxaConclusao: number; obras: number; unidadesSaude: number; escolas: number };
type IndicadorExterno = { key: string; nome: string; configurado: boolean; disponibilidade: string; registrosObservados: number | null; tipo: string | null; erro?: string | null };
type QualityResponse = { dimensions: Array<{ key: string; received: number; classified: number; unclassified: number; coverage: number }>; methodology: string };

function normalize(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    disponivel: "Disponível",
    disponivel_com_ressalvas: "Disponível com ressalvas",
    nao_configurado: "Não configurado",
    sem_atualizacao: "Sem atualização",
    indisponivel: "Indisponível",
    integrado: "Integrado",
    integrado_com_ressalvas: "Integrado com ressalvas",
    configuracao_necessaria: "Configuração necessária",
  };
  return labels[value] || value.replaceAll("_", " ");
}

function statusClass(value: string) {
  if (["disponivel", "integrado"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["disponivel_com_ressalvas", "integrado_com_ressalvas", "nao_configurado", "configuracao_necessaria", "sem_atualizacao"].includes(value)) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function qualityLabel(key: string) {
  return ({ works: "Obras", health: "Saúde", schools: "Escolas" } as Record<string, string>)[key] || key;
}

function bairroDaFeature(feature: MapFeature) {
  const attrs = feature.attributes || {};
  for (const key of ["BAIRRO", "NM_BAIRRO", "NOME_BAIRRO", "NOMEBAIRRO", "BAIRRO_NOME", "DS_BAIRRO"]) {
    if (attrs[key] != null && String(attrs[key]).trim()) return String(attrs[key]).trim();
  }
  const dynamic = Object.keys(attrs).find((key) => normalize(key).includes("BAIRRO"));
  return dynamic && attrs[dynamic] != null ? String(attrs[dynamic]).trim() : "";
}

function MapaBairros({ mapa, selecionado, onSelect }: { mapa: MapaResponse | null; selecionado: string; onSelect: (bairro: string) => void }) {
  const shapes = useMemo(() => {
    const features = mapa?.features || [];
    const allRings = features.flatMap((feature) => feature.geometry?.rings || []);
    const points = allRings.flat();
    if (!points.length) return [] as Array<{ d: string; bairro: string; key: string }>;
    const xs = points.map((point) => Number(point[0])).filter(Number.isFinite);
    const ys = points.map((point) => Number(point[1])).filter(Number.isFinite);
    if (!xs.length || !ys.length) return [] as Array<{ d: string; bairro: string; key: string }>;
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(0.000001, maxX - minX), height = Math.max(0.000001, maxY - minY);
    const pad = 18, canvasW = 800, canvasH = 420;
    const scale = Math.min((canvasW - pad * 2) / width, (canvasH - pad * 2) / height);
    const offsetX = (canvasW - width * scale) / 2;
    const offsetY = (canvasH - height * scale) / 2;
    const project = (point: number[]) => [offsetX + (point[0] - minX) * scale, canvasH - (offsetY + (point[1] - minY) * scale)];
    return features.flatMap((feature, featureIndex) => {
      const bairro = bairroDaFeature(feature);
      return (feature.geometry?.rings || []).map((ring, ringIndex) => ({
        bairro,
        key: `${featureIndex}-${ringIndex}`,
        d: ring.map((point, index) => {
          const [x, y] = project(point);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(" ") + " Z",
      }));
    });
  }, [mapa]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div><h2 className="text-lg font-bold text-slate-900">Mapa territorial de bairros</h2><p className="mt-1 text-sm text-slate-500">Toque em um bairro para abrir o diagnóstico territorial.</p></div>
        <span className="text-xs font-semibold text-slate-500">{mapa ? `${mapa.retornados} de ${mapa.total} áreas` : "Camada indisponível"}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {shapes.length ? (
          <svg viewBox="0 0 800 420" role="img" aria-label="Mapa interativo dos bairros de Manaus" className="block w-full h-auto min-h-64">
            <g strokeWidth="0.8" vectorEffect="non-scaling-stroke">
              {shapes.map((shape) => {
                const active = shape.bairro && normalize(shape.bairro) === normalize(selecionado);
                return <path key={shape.key} d={shape.d} role={shape.bairro ? "button" : undefined} tabIndex={shape.bairro ? 0 : -1} aria-label={shape.bairro || undefined} onClick={() => shape.bairro && onSelect(shape.bairro)} onKeyDown={(event) => { if (shape.bairro && (event.key === "Enter" || event.key === " ")) onSelect(shape.bairro); }} className={`${shape.bairro ? "cursor-pointer" : ""} ${active ? "fill-indigo-500 stroke-indigo-800" : "fill-indigo-100 stroke-indigo-500 hover:fill-indigo-200"}`} />;
              })}
            </g>
          </svg>
        ) : <div className="min-h-64 grid place-items-center px-6 text-center text-sm text-slate-500">A camada geográfica não pôde ser desenhada agora.</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{selecionado ? `Selecionado: ${selecionado}` : "Nenhum bairro selecionado"}</span>{selecionado && <button onClick={() => onSelect("")} className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700">Limpar seleção</button>}</div>
      {mapa?.truncated && <p className="mt-3 text-xs text-amber-700">A fonte retornou mais registros do que o limite seguro de visualização.</p>}
    </div>
  );
}

export default function RadarTerritorial() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [mapa, setMapa] = useState<MapaResponse | null>(null);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [indicadoresExternos, setIndicadoresExternos] = useState<IndicadorExterno[]>([]);
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function carregar() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const resumoResponse = await fetchWithTimeout(
        "/api/radar/manaus/resumo",
        { credentials: "same-origin", cache: "no-store", signal: controller.signal },
        8000
      );
      if (resumoResponse.status === 401 || resumoResponse.status === 403) {
        setHasAccess(false);
        throw new Error("Acesso privado não autorizado.");
      }
      if (!resumoResponse.ok) throw new Error("Não foi possível carregar o resumo territorial.");
      const resumoPayload = await resumoResponse.json();
      if (controller.signal.aborted) return;
      setHasAccess(true);
      setResumo(resumoPayload);
      setLoading(false);

      const optionalLoaders: Array<() => Promise<void>> = [
        async () => {
          const response = await fetchWithTimeout("/api/radar/manaus/fontes", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setFontes((await response.json()).fontes || []);
        },
        async () => {
          const response = await fetchWithTimeout("/api/radar/manaus/mapa/bairros", { credentials: "same-origin", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setMapa(await response.json());
        },
        async () => {
          const response = await fetchWithTimeout("/api/radar/manaus/territorios", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setTerritorios((await response.json()).territorios || []);
        },
        async () => {
          const response = await fetchWithTimeout("/api/radar/manaus/indicadores-externos", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) {
            const payload = await response.json();
            setIndicadoresExternos(payload.indicadores || []);
            if (payload.quality?.dimensions?.length) setQuality(payload.quality);
          }
        },
      ];

      for (const load of optionalLoaders) {
        if (controller.signal.aborted) break;
        try { await load(); } catch (optionalError: any) {
          if (controller.signal.aborted || optionalError?.name === "AbortError") break;
        }
      }
    } catch (e: any) {
      if (controller.signal.aborted || e?.name === "AbortError") return;
      setError(e?.message || "Falha ao carregar Radar Territorial.");
    } finally {
      if (controllerRef.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBairro = useMemo(() => Math.max(1, ...(resumo?.demandasPorBairro || []).map((item) => Number(item.total) || 0)), [resumo]);
  const territorioSelecionado = useMemo(() => territorios.find((item) => normalize(item.bairro) === normalize(bairroSelecionado)) || null, [territorios, bairroSelecionado]);
  const externalObserved = (needle: string) => indicadoresExternos.find((item) => normalize(item.nome).includes(needle))?.registrosObservados ?? null;
  const ageIntelligence = resumo?.demografiaEtaria || null;

  if (loading && !resumo) return <div className="py-16 text-center text-sm text-slate-500">Carregando Radar Territorial…</div>;
  if (!hasAccess) return <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm"><ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h1 className="text-2xl font-bold text-slate-900">Radar territorial restrito</h1><p className="mt-3 text-slate-600">Este módulo pertence ao núcleo privado e é exclusivo do administrador.</p></div>;

  const cards = [
    { label: "Bairros mapeados", value: resumo?.indicadores.bairros ?? mapa?.retornados ?? externalObserved("BAIRROS"), icon: MapPinned },
    { label: "Obras municipais", value: resumo?.indicadores.obras ?? externalObserved("OBRAS"), icon: Wrench },
    { label: "Unidades de saúde", value: resumo?.indicadores.unidadesSaude ?? externalObserved("SAUDE"), icon: HeartPulse },
    { label: "Escolas municipais", value: resumo?.indicadores.escolasMunicipais ?? externalObserved("ESCOLAS"), icon: GraduationCap },
    { label: "Demandas registradas", value: resumo?.indicadores.demandasRegistradas ?? 0, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5"><div><div className="flex items-center gap-2 text-indigo-700 text-sm font-semibold uppercase tracking-wide"><MapPinned className="w-4 h-4" /> Radar Territorial Manaus</div><h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">Inteligência territorial baseada em dados públicos</h1><p className="mt-3 max-w-4xl text-slate-600">Cruze obras, equipamentos, cobertura das fontes e dados agregados por bairro para acompanhar capacidade pública e mudanças territoriais.</p></div><button onClick={carregar} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button></div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">{cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"><Icon className="w-5 h-5 text-indigo-600 mb-3" /><p className="text-xs sm:text-sm text-slate-500">{card.label}</p><p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">{card.value == null ? "—" : Number(card.value).toLocaleString("pt-BR")}</p></div>; })}</section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><UsersRound className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Perfil etário dos registros</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Leitura municipal agregada para compreender a cobertura geracional do FISCALIZE, sem idade exata ou identificação individual.</p>
          </div>
        </div>

        {ageIntelligence ? <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-500">Cobertura etária</p><p className="mt-1 text-lg font-bold text-slate-900">{ageIntelligence.coberturaPercentual.toFixed(1)}%</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-500">Classificação detalhada</p><p className="mt-1 text-lg font-bold text-slate-900">{ageIntelligence.coberturaDetalhadaPercentual.toFixed(1)}%</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-500">Não informado</p><p className="mt-1 text-lg font-bold text-slate-900">{ageIntelligence.naoInformados.toLocaleString("pt-BR")}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-500">Diversidade geracional</p><p className="mt-1 text-lg font-bold text-slate-900">{ageIntelligence.diversidadeGeracional == null ? "Base em formação" : ageIntelligence.diversidadeGeracional.toFixed(3)}</p></div>
          </div>

          <div className="mt-5 space-y-3">
            {ageIntelligence.faixas.map((faixa) => (
              <div key={faixa.codigo} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{faixa.label}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-600">{faixa.suprimido ? "Amostra protegida" : `${faixa.total?.toLocaleString("pt-BR") || 0} · ${(faixa.percentual || 0).toFixed(1)}%`}</span>
                </div>
                {!faixa.suprimido && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(faixa.total ? 3 : 0, faixa.percentual || 0)}%` }} /></div>}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <strong>Proteção estatística:</strong> grupos abaixo de {ageIntelligence.limiarMinimo} registros recebem supressão complementar. O Radar não cruza faixa etária com nome, protocolo, endereço ou identidade.
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{ageIntelligence.metodologia}</p>
        </> : <p className="mt-5 text-sm text-slate-500">A inteligência etária ainda não está disponível neste ambiente.</p>}
      </section>

      {quality?.dimensions?.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Qualidade da territorialização</h2><p className="mt-1 text-sm text-slate-500">Mostra quantos registros recebidos das fontes puderam ser associados a um território.</p><div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">{quality.dimensions.map((item) => <div key={item.key} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{qualityLabel(item.key)}</p><p className="mt-2 text-sm text-slate-600">Recebidos: {item.received.toLocaleString("pt-BR")}</p><p className="text-sm text-slate-600">Territorializados: {item.classified.toLocaleString("pt-BR")}</p><p className="text-sm text-slate-600">Sem classificação: {item.unclassified.toLocaleString("pt-BR")}</p><p className="mt-2 text-lg font-bold text-indigo-700">{(item.coverage * 100).toFixed(1)}%</p></div>)}</div><p className="mt-3 text-xs text-slate-500">{quality.methodology}</p></section> : null}

      <MapaBairros mapa={mapa} selecionado={bairroSelecionado} onSelect={setBairroSelecionado} />

      {territorioSelecionado && <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 sm:p-6 shadow-sm"><div className="flex flex-col gap-1"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Diagnóstico territorial</p><h2 className="text-xl font-bold text-slate-900">{territorioSelecionado.bairro}</h2></div><div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">{[["Demandas", territorioSelecionado.demandas], ["Prioritárias", territorioSelecionado.prioritarias], ["Concluídas", territorioSelecionado.concluidas], ["Conclusão", `${territorioSelecionado.taxaConclusao}%`], ["Temas", territorioSelecionado.temas], ["Obras", territorioSelecionado.obras], ["Saúde", territorioSelecionado.unidadesSaude], ["Escolas", territorioSelecionado.escolas]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div>)}</div></section>}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Demandas por bairro</h2><p className="mt-1 text-sm text-slate-500">Selecione também pelo ranking para abrir o diagnóstico.</p><div className="mt-5 space-y-3">{(resumo?.demandasPorBairro || []).length === 0 ? <p className="text-sm text-slate-500">Ainda não há dados suficientes para o ranking.</p> : resumo?.demandasPorBairro.slice(0, 12).map((item) => <button type="button" onClick={() => setBairroSelecionado(item.bairro)} key={item.bairro} className="block w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700 truncate">{item.bairro}</span><span className="text-slate-500">{item.total}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, (Number(item.total) / maxBairro) * 100)}%` }} /></div></button>)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Problemas recorrentes</h2><p className="mt-1 text-sm text-slate-500">Tipos estruturados de ocorrência para leitura operacional e estatística.</p><div className="mt-5 divide-y divide-slate-100">{(resumo?.demandasPorTipo || []).length === 0 ? <p className="text-sm text-slate-500">Nenhum problema consolidado no momento.</p> : resumo?.demandasPorTipo.slice(0, 12).map((item) => <div key={`${item.categoria}-${item.tipo_problema}`} className="py-3 flex items-center justify-between gap-4"><span className="min-w-0"><span className="block text-sm font-semibold text-slate-700">{demandProblemLabel(item.categoria, item.tipo_problema)}</span><span className="block text-xs text-slate-400">{demandCategoryLabel(item.categoria)}</span></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.total}</span></div>)}</div></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Indicadores externos comparáveis</h2></div><p className="mt-1 text-sm text-slate-500">Todas as fontes são exibidas com o mesmo contrato: configuração, disponibilidade e volume observado.</p><div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{indicadoresExternos.map((item) => <div key={item.key} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.nome}</p><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(item.disponibilidade)}`}>{statusLabel(item.disponibilidade)}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Configurado</dt><dd className="mt-1 font-semibold text-slate-800">{item.configurado ? "Sim" : "Não"}</dd></div><div><dt className="text-slate-500">Registros</dt><dd className="mt-1 font-semibold text-slate-800">{item.registrosObservados == null ? "—" : Number(item.registrosObservados).toLocaleString("pt-BR")}</dd></div></dl>{item.erro && <p className="mt-3 text-xs text-slate-600 line-clamp-3">{item.erro}</p>}</div>)}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><div className="flex items-center gap-2"><Database className="w-5 h-5 text-indigo-600" /><h2 className="text-lg font-bold text-slate-900">Fontes de dados</h2></div><div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{fontes.map((fonte) => <div key={fonte.key} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{fonte.etapa}</p><p className="mt-1 text-sm font-semibold text-slate-900">{fonte.nome}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(fonte.status)}`}>{statusLabel(fonte.status)}</span></div><p className="mt-3 text-xs text-slate-500 break-all">{fonte.endpoint || fonte.paginaOficial || "Endpoint não configurado"}</p></div>)}</div></section>

      <section className="rounded-2xl bg-slate-900 p-5 sm:p-6 text-white shadow-sm"><h2 className="font-bold">Uso do radar</h2><p className="mt-2 text-sm text-slate-300">Os dados apoiam diagnóstico territorial, fiscalização e acompanhamento de políticas públicas. As análises permanecem agregadas e não usam atributos sensíveis ou preferência política individual.</p></section>
    </div>
  );
}
