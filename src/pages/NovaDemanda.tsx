import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, Camera, Check, CheckCircle2, Copy, FileText, Images, MapPin, RefreshCw, Search, Share2, ShieldCheck, Trash2, X } from "lucide-react";
import { getPulsoAttribution, trackPulsoEvent } from "../lib/mobileAnalytics";
import { prepareMobileEvidence } from "../lib/mobileImage";
import { clearSafeDemandDraft, readSafeDemandDraft, saveSafeDemandDraft } from "../lib/safeDemandDraft";
import { DEMAND_TAXONOMY, getDemandCategory } from "../shared/demandTaxonomy";
const MAX_PHOTOS = 7;
const DEMAND_IDEMPOTENCY_STORAGE_KEY = "fiscalize:demand-idempotency-key";

function getOrCreateDemandIdempotencyKey() {
  if (typeof window === "undefined") return "";
  const current = window.sessionStorage.getItem(DEMAND_IDEMPOTENCY_STORAGE_KEY);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const key = window.crypto.randomUUID();
  window.sessionStorage.setItem(DEMAND_IDEMPOTENCY_STORAGE_KEY, key);
  return key;
}

function clearDemandIdempotencyKey() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(DEMAND_IDEMPOTENCY_STORAGE_KEY);
}

type PreparedPhoto = { id: string; dataUrl: string; bytes: number };

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function NovaDemanda({ user }: { user?: any }) {
  const attribution = getPulsoAttribution();
  const [publicIntake, setPublicIntake] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState("");
  const [form, setForm] = useState({
    nome_solicitante: user?.type === "cidadao" ? String(user?.nome_completo || "") : "", contato: "", municipio: "Manaus", bairro: "", cep: "", logradouro: "", numero: "", complemento: "", uf: "AM", codigo_ibge: "",
    categoria: DEMAND_TAXONOMY[0].code, tipo_problema: DEMAND_TAXONOMY[0].problems[0].code, prioridade: "MEDIA", descricao: "", faixa_etaria: "", aviso_privacidade_aceito: false
  });
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepResolved, setCepResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [showReference, setShowReference] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const started = useRef(false);
  const trackedSteps = useRef(new Set<string>());

  const locationComplete = Boolean(form.logradouro.trim() && form.bairro.trim());
  const selectedCategory = getDemandCategory(form.categoria) || DEMAND_TAXONOMY[0];
  const photoDisabled = photoBusy || photos.length >= MAX_PHOTOS || form.faixa_etaria === "UNDER_16";
  const detailsComplete = Boolean(
    form.faixa_etaria &&
    form.faixa_etaria !== "UNDER_16" &&
    form.nome_solicitante.trim() &&
    form.categoria &&
    form.tipo_problema &&
    form.descricao.trim()
  );
  const reviewComplete = Boolean(locationComplete && detailsComplete && form.aviso_privacidade_aceito);
  const progressSteps = [
    { label: "Localize", complete: locationComplete },
    { label: "Descreva", complete: detailsComplete },
    { label: "Confirme", complete: reviewComplete },
  ];
  const completedSteps = progressSteps.filter((step) => step.complete).length;
  const progressPercent = Math.round((completedSteps / progressSteps.length) * 100);
  const mobileStepMeta = [
    { step: 1, label: "Localize" },
    { step: 2, label: "Descreva" },
    { step: 3, label: "Confirme" },
  ] as const;

  const focusField = (name: string) => {
    window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>(`[name="${name}"]`);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus();
    }, 60);
  };

  const validateLocationStep = () => {
    setError("");
    if (!form.faixa_etaria) { setError("Informe sua faixa etária para continuar."); focusField("faixa_etaria"); return false; }
    if (form.faixa_etaria === "UNDER_16") { setError("O envio autônomo de demandas no FISCALIZE está disponível a partir de 16 anos."); focusField("faixa_etaria"); return false; }
    if (form.cep && form.cep.replace(/\D/g, "").length !== 8) { setError("Revise o CEP do local do problema."); focusField("cep"); return false; }
    if (!form.logradouro.trim()) { setError("Informe o logradouro ou via da ocorrência."); focusField("logradouro"); return false; }
    if (!form.bairro.trim()) { setError("Informe o bairro ou localidade da ocorrência."); focusField("bairro"); return false; }
    return true;
  };

  const validateDetailsStep = () => {
    setError("");
    if (!form.nome_solicitante.trim()) { setError("Informe seu nome para continuar."); focusField("nome_solicitante"); return false; }
    if (!form.categoria) { setError("Selecione a área do problema."); focusField("categoria"); return false; }
    if (!form.tipo_problema) { setError("Selecione o tipo do problema."); focusField("tipo_problema"); return false; }
    if (!form.descricao.trim()) { setError("Descreva o que aconteceu."); focusField("descricao"); return false; }
    return true;
  };

  const goToStep = (step: 1 | 2 | 3) => {
    setError("");
    setMobileStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueFromLocation = () => {
    if (!validateLocationStep()) return;
    goToStep(2);
  };

  const continueToReview = () => {
    if (!validateDetailsStep()) return;
    goToStep(3);
  };

  const ageBandLabel = (value: string) => {
    const labels: Record<string, string> = {
      UNDER_16: "Menos de 16 anos",
      AGE_16_17: "16 a 17 anos",
      AGE_18_24: "18 a 24 anos",
      AGE_25_34: "25 a 34 anos",
      AGE_35_44: "35 a 44 anos",
      AGE_45_59: "45 a 59 anos",
      AGE_60_PLUS: "60 anos ou mais",
    };
    return labels[value] || value;
  };

  const loadPublicConfig = async () => {
    setConfigError("");
    setPublicIntake(null);
    try {
      const response = await fetch("/api/public-config", { cache: "no-store" });
      if (!response.ok) throw new Error("Configuração pública indisponível.");
      const data = await response.json();
      setPublicIntake(Boolean(data.publicDemandIntake));
    } catch {
      setConfigError("Não foi possível confirmar agora se o recebimento de demandas está disponível.");
    }
  };

  useEffect(() => {
    void loadPublicConfig();
    trackPulsoEvent("form_view", attribution);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attribution.src, attribution.acao]);

  useEffect(() => {
    setDraftAvailable(Boolean(readSafeDemandDraft()));
  }, []);

  useEffect(() => {
    const milestones = [
      ["form_step_location", locationComplete],
      ["form_step_details", detailsComplete],
      ["form_step_review", reviewComplete],
    ] as const;

    for (const [event, complete] of milestones) {
      if (!complete || trackedSteps.current.has(event)) continue;
      trackedSteps.current.add(event);
      trackPulsoEvent(event, attribution);
    }
  }, [locationComplete, detailsComplete, reviewComplete, attribution.src, attribution.acao]);

  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    trackPulsoEvent("form_start", attribution);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    markStarted();
    const { name, value } = event.target;
    const nextValue = event.target instanceof HTMLInputElement && event.target.type === "checkbox" ? event.target.checked : value;
    if (name === "categoria" && typeof nextValue === "string") {
      const category = getDemandCategory(nextValue);
      setForm(prev => ({ ...prev, categoria: nextValue, tipo_problema: category?.problems[0]?.code || "" }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleCepChange = (event: ChangeEvent<HTMLInputElement>) => {
    markStarted();
    setCepError("");
    setCepResolved(false);
    const value = formatCep(event.target.value);
    setForm(prev => ({ ...prev, cep: value, codigo_ibge: "" }));
  };

  const lookupCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    setCepError("");
    setCepResolved(false);
    if (!cep) return;
    if (cep.length !== 8) {
      setCepError("Informe um CEP com 8 dígitos.");
      return;
    }
    setCepBusy(true);
    try {
      const response = await fetch(`/api/localizacao/cep/${cep}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar o CEP.");
      if (String(data.municipio || "").toLowerCase() !== "manaus" || String(data.uf || "").toUpperCase() !== "AM") {
        setCepError("Este formulário recebe ocorrências de Manaus. Informe um CEP de Manaus ou preencha a localização manualmente sem o CEP.");
        return;
      }
      setForm(prev => ({
        ...prev,
        cep: String(data.cep || prev.cep),
        logradouro: String(data.logradouro || prev.logradouro),
        bairro: String(data.bairro || prev.bairro),
        municipio: "Manaus",
        uf: "AM",
        codigo_ibge: String(data.codigo_ibge || ""),
      }));
      setCepResolved(true);
    } catch (err: any) {
      setCepError(err.message || "Não foi possível consultar o CEP. Preencha a localização manualmente.");
    } finally {
      setCepBusy(false);
    }
  };

  const addPhotoFiles = async (files: File[]) => {
    if (!files.length) return;
    markStarted();
    setError("");

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError("Você já adicionou o limite de 7 fotos.");
      return;
    }

    const selected = files.slice(0, remaining);
    const warnings: string[] = [];
    if (files.length > remaining) {
      warnings.push(`Você pode adicionar no máximo 7 fotos. Foram consideradas apenas as primeiras ${remaining}.`);
    }

    setPhotoBusy(true);
    try {
      const preparedPhotos: PreparedPhoto[] = [];
      const failedMessages: string[] = [];
      for (const file of selected) {
        try {
          const prepared = await prepareMobileEvidence(file);
          preparedPhotos.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            dataUrl: prepared.dataUrl,
            bytes: prepared.bytes,
          });
        } catch (err: any) {
          failedMessages.push(err?.message || "Não foi possível preparar esta foto.");
        }
      }
      if (preparedPhotos.length) setPhotos((current) => [...current, ...preparedPhotos].slice(0, MAX_PHOTOS));
      if (failedMessages.length) {
        const uniqueMessages = [...new Set(failedMessages)];
        warnings.push(`${failedMessages.length} foto${failedMessages.length === 1 ? " não pôde" : "s não puderam"} ser adicionada${failedMessages.length === 1 ? "" : "s"}. ${uniqueMessages.slice(0, 2).join(" ")}`);
      }
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleCameraPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    await addPhotoFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handleGalleryPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    await addPhotoFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  };

  const saveDraft = () => {
    saveSafeDemandDraft({
      bairro: form.bairro,
      categoria: form.categoria,
      tipo_problema: form.tipo_problema,
    });
    setDraftAvailable(true);
    setDraftMessage("Rascunho seguro salvo neste dispositivo por até 6 horas.");
  };

  const restoreDraft = () => {
    const draft = readSafeDemandDraft();
    if (!draft) {
      setDraftAvailable(false);
      setDraftMessage("O rascunho não está mais disponível.");
      return;
    }
    setForm(prev => ({ ...prev, ...draft.values }));
    setDraftMessage("Bairro/localidade e categoria restaurados.");
    markStarted();
  };

  const deleteDraft = () => {
    clearSafeDemandDraft();
    setDraftAvailable(false);
    setDraftMessage("Rascunho apagado deste dispositivo.");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setProtocolo(null);
    const mobileFlow = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    if (mobileFlow && mobileStep === 1) { continueFromLocation(); return; }
    if (mobileFlow && mobileStep === 2) { continueToReview(); return; }
    setLoading(true);
    if (!form.faixa_etaria) { setMobileStep(1); setError("Informe sua faixa etária para continuar."); focusField("faixa_etaria"); setLoading(false); return; }
    if (form.faixa_etaria === "UNDER_16") { setMobileStep(1); setError("O envio autônomo de demandas no FISCALIZE está disponível a partir de 16 anos."); focusField("faixa_etaria"); setLoading(false); return; }
    if (form.cep && form.cep.replace(/\D/g, "").length !== 8) { setMobileStep(1); setError("Revise o CEP do local do problema."); focusField("cep"); setLoading(false); return; }
    if (!form.logradouro.trim()) { setMobileStep(1); setError("Informe o logradouro ou via da ocorrência."); focusField("logradouro"); setLoading(false); return; }
    if (!form.bairro.trim()) { setMobileStep(1); setError("Informe o bairro ou localidade da ocorrência."); focusField("bairro"); setLoading(false); return; }
    if (!form.nome_solicitante.trim()) { setMobileStep(2); setError("Informe seu nome para continuar."); focusField("nome_solicitante"); setLoading(false); return; }
    if (!form.categoria) { setMobileStep(2); setError("Selecione a área do problema."); focusField("categoria"); setLoading(false); return; }
    if (!form.tipo_problema) { setMobileStep(2); setError("Selecione o tipo do problema."); focusField("tipo_problema"); setLoading(false); return; }
    if (!form.descricao.trim()) { setMobileStep(2); setError("Descreva o que aconteceu."); focusField("descricao"); setLoading(false); return; }
    if (!form.aviso_privacidade_aceito) { setMobileStep(3); setError("Marque a opção de privacidade para continuar."); focusField("aviso_privacidade_aceito"); setLoading(false); return; }
    try {
      const idempotencyKey = getOrCreateDemandIdempotencyKey();
      const response = await fetch("/api/demandas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ ...form, cep: form.cep.replace(/\D/g, ""), ...attribution, foto_evidencias_base64: photos.map((photo) => photo.dataUrl) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.code === "IDEMPOTENCY_KEY_REUSED" || data?.code === "INVALID_IDEMPOTENCY_KEY") clearDemandIdempotencyKey();
        throw new Error(data.error || "Não foi possível enviar seu registro.");
      }
      clearDemandIdempotencyKey();
      setProtocolo(data.protocolo); trackPulsoEvent("protocolo_view", attribution);
      clearSafeDemandDraft(); setDraftAvailable(false);
      setForm(prev => ({ ...prev, descricao: "", aviso_privacidade_aceito: false })); setPhotos([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) { setError(err.message || "Não foi possível enviar seu registro."); }
    finally { setLoading(false); }
  };

  const copyProtocol = async () => {
    if (!protocolo) return;
    await navigator.clipboard?.writeText(protocolo);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const shareProtocol = async () => {
    if (!protocolo) return;
    const url = `${window.location.origin}/protocolo?codigo=${encodeURIComponent(protocolo)}&share=2`;
    const text = `Meu registro no FISCALIZE. Protocolo: ${protocolo}`;
    trackPulsoEvent("protocolo_share", attribution);
    if (navigator.share) await navigator.share({ title: "FISCALIZE Manaus", text, url });
    else await navigator.clipboard?.writeText(`${text}\n${url}`);
  };

  if (publicIntake === null && !configError) {
    return <div className="mx-auto max-w-xl py-8 sm:py-14"><div className="surface-card p-6 text-center sm:p-8"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2fb] text-[#1f2e6e]"><RefreshCw className="h-5 w-5 animate-spin" /></span><h1 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-[#172033]">Confirmando disponibilidade.</h1><p className="mt-3 text-sm leading-relaxed text-[#657089]">Estamos verificando se o recebimento público de demandas está ativo.</p></div></div>;
  }

  if (publicIntake === null && configError) {
    return <div className="mx-auto max-w-xl py-8 sm:py-14"><div className="surface-card p-6 sm:p-8"><span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-800">Não foi possível confirmar o serviço</span><h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#172033]">Tente novamente antes de preencher o formulário.</h1><p className="mt-3 text-sm leading-relaxed text-[#657089]">{configError} Isso não significa que os registros estejam fechados.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => void loadPublicConfig()} className="primary-button w-full"><RefreshCw className="h-4 w-4" /> Tentar novamente</button><Link to="/protocolo" className="secondary-button w-full">Acompanhar protocolo</Link></div></div></div>;
  }

  if (publicIntake === false) {
    return <div className="mx-auto max-w-xl py-8 sm:py-14"><div className="surface-card p-6 sm:p-8"><span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-800">Registros indisponíveis neste momento</span><h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#172033]">O recebimento público está desativado.</h1><p className="mt-3 text-sm leading-relaxed text-[#657089]">Protocolos já emitidos continuam disponíveis para consulta. A indisponibilidade do formulário não altera o histórico dos registros existentes.</p><Link to="/protocolo" className="secondary-button mt-6 w-full">Acompanhar protocolo</Link></div></div>;
  }

  if (protocolo) {
    return <div className="mx-auto max-w-2xl py-5 sm:py-10"><div className="surface-card overflow-hidden"><div className="h-1.5 bg-[#f36a10]" aria-hidden="true" /><div className="p-6 text-center sm:p-9"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eef2fb] text-[#1f2e6e]"><CheckCircle2 className="h-8 w-8" /></span><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#f36a10]">Você cuidando da cidade</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#172033]">Pronto. Seu registro foi enviado.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#657089] sm:text-base">Guarde este protocolo. Você vai usar esse código para acompanhar as atualizações.</p><div className="mt-6 rounded-2xl bg-[#1f2e6e] px-4 py-5 font-mono text-xl font-bold tracking-wide text-white break-all sm:text-2xl">{protocolo}</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyProtocol} className="secondary-button px-3">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar código"}</button><button onClick={shareProtocol} className="secondary-button px-3"><Share2 className="h-4 w-4" />Compartilhar</button></div><div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-center"><Link to={`/protocolo?codigo=${encodeURIComponent(protocolo)}`} className="primary-button min-h-14 px-6 text-base">Ver andamento <ArrowRight className="h-4 w-4" /></Link>{user?.type === "cidadao" && <Link to="/meus-registros" className="secondary-button min-h-14 px-6 text-base">Ver meus registros</Link>}<button onClick={() => setProtocolo(null)} className="secondary-button min-h-14 px-6 text-base">Registrar outro</button></div></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-3xl py-2 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center justify-between gap-3">
          <span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5"><FileText className="h-3.5 w-3.5" /> FISCALIZE · Registrar</span>
          <span className="text-xs font-extrabold text-[#657089] sm:hidden">Etapa {mobileStep} de 3</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl">
          <span className="sm:hidden">Registrar ocorrência</span>
          <span className="hidden sm:inline">Registre uma situação do seu bairro.</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#657089] sm:mt-3 sm:max-w-2xl sm:text-base">
          <span className="sm:hidden">{mobileStep === 1 ? "Informe sua faixa etária e localize o ponto da ocorrência." : mobileStep === 2 ? "Descreva o problema e, se quiser, adicione evidências." : "Revise as informações e confirme o aviso de privacidade antes de enviar."}</span>
          <span className="hidden sm:inline">Informe o local e descreva o que aconteceu. O FISCALIZE organiza o relato e gera um protocolo para você acompanhar depois.</span>
        </p>

        <div data-engagement-progress="transparent" className="mt-4 rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-3.5 sm:mt-5 sm:p-5">
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-3 text-xs font-extrabold text-[#526078]">
              <span>{mobileStepMeta[mobileStep - 1].label}</span>
              <span>{mobileStep}/3</span>
            </div>
            <div role="progressbar" aria-label="Etapa do registro" aria-valuemin={1} aria-valuemax={3} aria-valuenow={mobileStep} className="mt-3 flex items-center gap-2">
              {mobileStepMeta.map((item, index) => <div key={item.step} className="flex flex-1 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.step <= mobileStep ? "bg-[#1f2e6e]" : "bg-white ring-1 ring-[#c4cfe3]"}`} />{index < 2 && <span className={`h-0.5 flex-1 ${item.step < mobileStep ? "bg-[#1f2e6e]" : "bg-white"}`} />}</div>)}
            </div>
          </div>

          <div className="hidden sm:block">
            <div className="flex items-center justify-between gap-4 text-sm font-bold text-[#526078]">
              <span>Seu progresso no registro</span>
              <span>{completedSteps} de {progressSteps.length} etapas</span>
            </div>
            <div role="progressbar" aria-label="Progresso do registro" aria-valuemin={0} aria-valuemax={progressSteps.length} aria-valuenow={completedSteps} className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#1f2e6e] transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {progressSteps.map((step, index) => (
                <div key={step.label} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${step.complete ? "border-[#b7c6e8] bg-white text-[#1f2e6e]" : "border-transparent bg-[#f7f9fd] text-[#657089]"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${step.complete ? "bg-[#1f2e6e] text-white" : "border border-[#c4cfe3] bg-white text-[#657089]"}`}>{step.complete ? <Check className="h-3.5 w-3.5" /> : `0${index + 1}`}</span>
                  {step.label}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#657089]">O indicador é apenas orientativo: não há contagem regressiva, pontuação ou penalidade. Revise as informações no seu ritmo antes de enviar.</p>
          </div>
        </div>
      </div>

      <details data-safe-draft="explicit" className="mb-4 rounded-2xl border border-[#d7e0f2] bg-white sm:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-[#172033]">
          <span className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-[#1f2e6e]" /> Salvar para continuar depois</span>
          {draftAvailable && <span className="text-[11px] text-[#1f2e6e]">rascunho disponível</span>}
        </summary>
        <div className="border-t border-[#eef2fb] px-4 py-4">
          <p className="text-xs leading-5 text-[#657089]">Somente bairro/localidade, área e tipo de problema são armazenados neste dispositivo por até 6 horas. CEP, endereço, nome, contato, descrição, fotos, faixa etária e aceite de privacidade não são salvos.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draftAvailable && <button type="button" onClick={restoreDraft} className="secondary-button min-h-11 px-4 text-sm">Restaurar</button>}
            <button type="button" onClick={saveDraft} className="secondary-button min-h-11 px-4 text-sm"><Bookmark className="h-4 w-4" /> {draftAvailable ? "Atualizar" : "Salvar rascunho"}</button>
            {draftAvailable && <button type="button" onClick={deleteDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#657089] hover:bg-[#f7f9fd]"><Trash2 className="h-4 w-4" /> Apagar</button>}
          </div>
          {draftMessage && <p aria-live="polite" className="mt-2 text-xs font-semibold text-[#1f2e6e]">{draftMessage}</p>}
        </div>
      </details>

      <section data-safe-draft="explicit-desktop" className="mb-6 hidden rounded-2xl border border-[#d7e0f2] bg-white p-5 sm:block">
        <div className="flex items-start gap-3">
          <span className="icon-tile"><Bookmark className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-extrabold text-[#172033]">Rascunho seguro neste dispositivo</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#657089]">Se você quiser, salve somente bairro/localidade, área e tipo de problema por até 6 horas. CEP, rua, número, complemento, nome, contato, descrição, foto, faixa etária e aceite de privacidade não são salvos.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {draftAvailable && <button type="button" onClick={restoreDraft} className="secondary-button min-h-11 px-4 text-sm">Restaurar rascunho</button>}
              <button type="button" onClick={saveDraft} className="secondary-button min-h-11 px-4 text-sm"><Bookmark className="h-4 w-4" /> {draftAvailable ? "Atualizar rascunho" : "Salvar rascunho"}</button>
              {draftAvailable && <button type="button" onClick={deleteDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#657089] hover:bg-[#f7f9fd]"><Trash2 className="h-4 w-4" /> Apagar</button>}
            </div>
            {draftMessage && <p aria-live="polite" className="mt-2 text-xs font-semibold text-[#1f2e6e]">{draftMessage}</p>}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} noValidate className="surface-card space-y-5 p-4 sm:space-y-6 sm:p-8" data-mobile-register-flow="guided">
        {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{error}</div>}

        <section data-register-step="1" className={`${mobileStep === 1 ? "block" : "hidden"} space-y-5 sm:block`}>
          <label className="block">
            <span className="text-sm font-bold text-[#172033]">Faixa etária</span>
            <select name="faixa_etaria" value={form.faixa_etaria} onChange={handleChange} required className="field text-base">
              <option value="">Selecione</option>
              <option value="UNDER_16">Menos de 16 anos</option>
              <option value="AGE_16_17">16 a 17 anos</option>
              <option value="AGE_18_24">18 a 24 anos</option>
              <option value="AGE_25_34">25 a 34 anos</option>
              <option value="AGE_35_44">35 a 44 anos</option>
              <option value="AGE_45_59">45 a 59 anos</option>
              <option value="AGE_60_PLUS">60 anos ou mais</option>
            </select>
            <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">Pedimos apenas a faixa etária para aplicar as proteções adequadas. O envio autônomo de demandas começa aos 16 anos.</span>
          </label>
          {form.faixa_etaria === "UNDER_16" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Você pode consultar o conteúdo público do FISCALIZE, mas o envio autônomo de demandas está disponível a partir de 16 anos.</div>}
          {form.faixa_etaria === "AGE_16_17" && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900"><strong>Proteção reforçada:</strong> seu registro terá tratamento mais restrito. Evite informar escola, endereço residencial, dados de saúde, documentos ou outras informações pessoais que não sejam necessárias.</div>}

          <section className="rounded-2xl border border-[#d7e0f2] bg-[#f7f9fd] p-4 sm:p-5">
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#1f2e6e]" /><div><h2 className="font-extrabold text-[#172033]">Local da ocorrência</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Informe o endereço do problema, não seu endereço residencial. O CEP é opcional e pode preencher parte da localização automaticamente.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4">
              <label className="block"><span className="text-sm font-bold text-[#172033]">CEP do local <span className="font-normal text-slate-500">(opcional)</span></span><input name="cep" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={handleCepChange} onBlur={() => { if (form.cep.replace(/\D/g, "").length === 8 && !cepResolved) void lookupCep(); }} className="field text-base" placeholder="69000-000" /></label>
              <button type="button" onClick={() => void lookupCep()} disabled={cepBusy || !form.cep} className="secondary-button min-h-12 px-5 disabled:opacity-50">{cepBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{cepBusy ? "Consultando" : "Buscar CEP"}</button>
            </div>
            {cepError && <p className="mt-2 text-xs leading-relaxed text-amber-700">{cepError}</p>}
            {cepResolved && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1f2e6e]"><Check className="h-3.5 w-3.5" /> CEP localizado. Revise o endereço.</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_11rem]">
              <label className="block"><span className="text-sm font-bold text-[#172033]">Logradouro ou via</span><input name="logradouro" value={form.logradouro} onChange={handleChange} required className="field text-base" placeholder="Ex.: Av. Torquato Tapajós" /></label>
              <label className="block"><span className="text-sm font-bold text-[#172033]">Número <span className="font-normal text-slate-500">(opcional)</span></span><input name="numero" value={form.numero} onChange={handleChange} className="field text-base" placeholder="Ex.: 1200 ou s/n" /></label>
            </div>
            <div className="mt-4">
              <label className="block"><span className="text-sm font-bold text-[#172033]">Bairro ou localidade</span><input name="bairro" value={form.bairro} onChange={handleChange} autoComplete="address-level3" required className="field text-base" placeholder="Ex.: Cidade Nova" /></label>
            </div>

            {!showReference && !form.complemento && <button type="button" onClick={() => setShowReference(true)} className="mt-3 min-h-11 text-sm font-extrabold text-[#1f2e6e] sm:hidden">+ Adicionar ponto de referência</button>}
            <label className={`mt-4 ${showReference || form.complemento ? "block" : "hidden"} sm:block`}><span className="text-sm font-bold text-[#172033]">Complemento / ponto de referência <span className="font-normal text-slate-500">(opcional)</span></span><input name="complemento" value={form.complemento} onChange={handleChange} className="field text-base" placeholder="Ex.: em frente à escola" /></label>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> Manaus / AM</p>
            {locationComplete && <p aria-live="polite" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#1f2e6e]"><Check className="h-3.5 w-3.5" /> Localização principal preenchida.</p>}
          </section>

          <button type="button" onClick={continueFromLocation} disabled={form.faixa_etaria === "UNDER_16"} className="primary-button min-h-14 w-full text-base disabled:cursor-not-allowed disabled:opacity-50 sm:hidden">Continuar <ArrowRight className="h-5 w-5" /></button>
        </section>

        <section data-register-step="2" className={`${mobileStep === 2 ? "block" : "hidden"} space-y-5 sm:block`}>
          <label className="block"><span className="text-sm font-bold text-[#172033]">Seu nome</span><input name="nome_solicitante" value={form.nome_solicitante} onChange={handleChange} autoComplete="name" required className="field text-base" placeholder="Digite seu nome" /></label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-[#172033]">Área do problema</span>
              <select name="categoria" value={form.categoria} onChange={handleChange} required className="field text-base">
                {DEMAND_TAXONOMY.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-[#172033]">Qual é o problema?</span>
              <select name="tipo_problema" value={form.tipo_problema} onChange={handleChange} required className="field text-base">
                {selectedCategory.problems.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block"><span className="text-sm font-bold text-[#172033]">O que aconteceu?</span><textarea name="descricao" value={form.descricao} onChange={handleChange} required rows={5} className="field min-h-36 text-base leading-relaxed" placeholder="O que aconteceu? Onde exatamente? Há quanto tempo?" /><span className="mt-1.5 block text-xs leading-5 text-slate-500">Evite informar documentos, dados de saúde ou dados pessoais de terceiros que não sejam necessários para descrever o problema.</span></label>
          {detailsComplete && <p aria-live="polite" className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1f2e6e]"><Check className="h-3.5 w-3.5" /> Informações principais do relato preenchidas.</p>}

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#172033]">Adicionar evidências <span className="font-normal text-slate-500">(opcional)</span></span>
              <span className="text-xs font-bold text-[#657089]">{photos.length} de {MAX_PHOTOS}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={`relative flex min-h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-[#c4cfe3] bg-[#f7f9fd] px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-[#7d8fc1] hover:bg-[#eef2fb] ${photoDisabled ? "opacity-50" : ""}`}>
                <Camera className="h-4.5 w-4.5 text-[#1f2e6e]" /><span>Câmera</span>
                <input name="camera_photo" type="file" accept="image/*" capture="environment" aria-label="Tirar foto com a câmera" onClick={(event) => { event.currentTarget.value = ""; }} onChange={handleCameraPhoto} disabled={photoDisabled} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
              </div>
              <div className={`relative flex min-h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-[#c4cfe3] bg-[#f7f9fd] px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-[#7d8fc1] hover:bg-[#eef2fb] ${photoDisabled ? "opacity-50" : ""}`}>
                <Images className="h-4.5 w-4.5 text-[#1f2e6e]" /><span>Galeria</span>
                <input name="gallery_photos" type="file" accept="image/*" multiple aria-label="Escolher fotos da galeria" onClick={(event) => { event.currentTarget.value = ""; }} onChange={handleGalleryPhotos} disabled={photoDisabled} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
              </div>
            </div>
            {photoBusy && <p className="mt-2 text-xs font-semibold text-[#1f2e6e]">Preparando foto(s) para envio...</p>}
            {photos.length > 0 && <div className="mt-3 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
              {photos.map((photo, index) => <div key={photo.id} className="relative w-36 shrink-0 overflow-hidden rounded-2xl border border-[#d7e0f2] bg-white sm:w-auto">
                <img src={photo.dataUrl} alt={`Prévia da foto ${index + 1}`} className="h-24 w-full object-cover sm:h-28" />
                <button type="button" onClick={() => removePhoto(photo.id)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-white" aria-label={`Remover foto ${index + 1}`}><X className="h-4 w-4" /></button>
                <div className="px-3 py-2"><p className="text-[11px] font-bold text-[#34425b]">Foto {index + 1}</p><p className="text-[10px] text-[#7b8599]">{Math.round(photo.bytes / 1024)} KB</p></div>
              </div>)}
            </div>}
            <p className="mt-2 text-xs leading-relaxed text-slate-500"><strong>Privacidade das fotos:</strong> até 7 imagens em armazenamento privado para análise administrativa. Elas não aparecem na consulta pública por protocolo. Evite fotografar pessoas, documentos ou placas quando isso não for necessário.</p>
          </div>

          {!showContact && !form.contato && <button type="button" onClick={() => setShowContact(true)} className="min-h-11 text-sm font-extrabold text-[#1f2e6e] sm:hidden">+ Adicionar contato para retorno</button>}
          <label className={`${showContact || form.contato ? "block" : "hidden"} sm:block`}><span className="text-sm font-bold text-[#172033]">Contato <span className="font-normal text-slate-500">(opcional)</span></span><input name="contato" value={form.contato} onChange={handleChange} autoComplete="tel" placeholder="Telefone ou e-mail, se quiser receber retorno" className="field text-base" /><span className="mt-1.5 block text-xs leading-5 text-slate-500">O protocolo é gerado mesmo sem contato.</span></label>

          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <button type="button" onClick={() => goToStep(1)} className="secondary-button min-h-14 w-full text-base">Voltar</button>
            <button type="button" onClick={continueToReview} className="primary-button min-h-14 w-full text-base">Revisar <ArrowRight className="h-5 w-5" /></button>
          </div>
        </section>

        <input type="hidden" name="municipio" value={form.municipio} /><input type="hidden" name="uf" value={form.uf} /><input type="hidden" name="codigo_ibge" value={form.codigo_ibge} /><input type="hidden" name="prioridade" value={form.prioridade} />

        <section data-register-step="3" className={`${mobileStep === 3 ? "block" : "hidden"} space-y-4 sm:block`}>
          <div className="rounded-2xl border border-[#d7e0f2] bg-white sm:hidden" data-register-review>
            <div className="border-b border-[#eef2fb] px-4 py-3"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#657089]">Revise antes de enviar</p></div>
            <div className="divide-y divide-[#eef2fb]">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Local</p><button type="button" onClick={() => goToStep(1)} className="min-h-11 px-2 text-xs font-extrabold text-[#1f2e6e]">Editar</button></div>
                <p className="text-sm font-bold text-[#172033]">{form.logradouro}{form.numero ? `, ${form.numero}` : ""}</p><p className="mt-0.5 text-xs text-[#657089]">{form.bairro} · Manaus/AM</p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Problema</p><button type="button" onClick={() => goToStep(2)} className="min-h-11 px-2 text-xs font-extrabold text-[#1f2e6e]">Editar</button></div>
                <p className="text-sm font-bold text-[#172033]">{selectedCategory.label}</p><p className="mt-0.5 text-xs text-[#657089]">{selectedCategory.problems.find((item) => item.code === form.tipo_problema)?.label || form.tipo_problema}</p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Relato</p><button type="button" onClick={() => goToStep(2)} className="min-h-11 px-2 text-xs font-extrabold text-[#1f2e6e]">Editar</button></div>
                <p className="line-clamp-4 text-sm leading-5 text-[#34425b]">{form.descricao}</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-[#eef2fb]">
                <div className="px-4 py-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Evidências</p><p className="mt-1 text-sm font-bold text-[#172033]">{photos.length ? `${photos.length} foto${photos.length === 1 ? "" : "s"}` : "Nenhuma"}</p></div>
                <div className="px-4 py-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Contato</p><p className="mt-1 truncate text-sm font-bold text-[#172033]">{form.contato || "Não informado"}</p></div>
              </div>
              <div className="px-4 py-3"><p className="text-xs font-extrabold uppercase tracking-wide text-[#657089]">Faixa etária</p><p className="mt-1 text-sm font-bold text-[#172033]">{ageBandLabel(form.faixa_etaria)}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d7e0f2] bg-[#eef2fb] p-4 sm:p-5">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#1f2e6e]" /><div className="space-y-3"><p className="text-xs leading-relaxed text-[#526078] sm:text-sm">A localização detalhada é usada para identificar o ponto da ocorrência e permanece restrita ao fluxo administrativo. Evite informar endereço residencial se ele não for o local do problema.</p><label className="flex cursor-pointer items-start gap-3 text-sm text-[#33466f]"><input type="checkbox" name="aviso_privacidade_aceito" checked={form.aviso_privacidade_aceito} onChange={handleChange} className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#7d8fc1]" required /><span>Entendi que meus dados serão tratados no FISCALIZE para registrar e acompanhar este caso. Gilmar Nascimento é o controlador dos dados das demandas. <Link to="/privacidade" className="font-extrabold underline">Ver privacidade</Link>.</span></label></div></div>
          </div>
          {reviewComplete && <p aria-live="polite" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#1f2e6e]"><Check className="h-3.5 w-3.5" /> Etapas preenchidas. Envie quando estiver pronto.</p>}

          <div className="grid gap-2 sm:block">
            <button type="button" onClick={() => goToStep(2)} className="secondary-button min-h-14 w-full text-base sm:hidden">Voltar e editar</button>
            <button disabled={loading || photoBusy || form.faixa_etaria === "UNDER_16"} className="primary-button min-h-14 w-full text-base disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Enviando..." : "Enviar e gerar protocolo"}<ArrowRight className="h-5 w-5" /></button>
          </div>
          <p className="text-center text-xs leading-relaxed text-slate-500">O FISCALIZE registra, organiza e acompanha demandas por protocolo. A plataforma não substitui canais oficiais nem garante, por si só, a solução de um problema.</p>
        </section>
      </form>
    </div>
  );
}
