import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Check, CheckCircle2, Clock3, Copy, FileText, MapPin, Share2, ShieldCheck } from "lucide-react";
import { getPulsoAttribution, trackPulsoEvent } from "../lib/mobileAnalytics";
import { prepareMobileEvidence } from "../lib/mobileImage";

const categorias = ["Infraestrutura","Saúde","Educação","Mobilidade","Segurança Pública","Assistência Social","Meio Ambiente","Outro"];

export default function NovaDemanda() {
  const attribution = getPulsoAttribution();
  const [publicIntake, setPublicIntake] = useState<boolean | null>(null);
  const [form, setForm] = useState({ nome_solicitante: "", contato: "", municipio: "Manaus", bairro: "", categoria: "Infraestrutura", prioridade: "MEDIA", descricao: "", faixa_etaria: "", aviso_privacidade_aceito: false });
  const [photoData, setPhotoData] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    fetch('/api/public-config').then(r => r.json()).then(data => setPublicIntake(Boolean(data.publicDemandIntake))).catch(() => setPublicIntake(false));
    trackPulsoEvent('form_view', attribution);
  }, [attribution.src, attribution.acao]);

  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    trackPulsoEvent('form_start', attribution);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    markStarted();
    const { name, value } = event.target;
    const nextValue = event.target instanceof HTMLInputElement && event.target.type === "checkbox" ? event.target.checked : value;
    setForm(prev => ({ ...prev, [name]: nextValue }));
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    markStarted();
    setPhotoBusy(true); setError("");
    try {
      const prepared = await prepareMobileEvidence(file);
      setPhotoData(prepared.dataUrl);
      setPhotoName(`${file.name} · ${Math.round(prepared.bytes / 1024)} KB`);
    } catch (err: any) { setError(err.message || 'Não foi possível preparar a foto.'); }
    finally { setPhotoBusy(false); }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setProtocolo(null);
    if (!form.faixa_etaria) { setError("Informe sua faixa etária para continuar."); setLoading(false); return; }
    if (form.faixa_etaria === "UNDER_16") { setError("O envio autônomo de demandas no FISCALIZE está disponível a partir de 16 anos."); setLoading(false); return; }
    if (!form.aviso_privacidade_aceito) { setError("Marque a opção de privacidade para continuar."); setLoading(false); return; }
    try {
      const response = await fetch("/api/demandas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...attribution, foto_evidencia_base64: photoData || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar seu registro.");
      setProtocolo(data.protocolo); trackPulsoEvent('protocolo_view', attribution);
      setForm(prev => ({ ...prev, descricao: "", aviso_privacidade_aceito: false })); setPhotoData(''); setPhotoName('');
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
    const url = `${window.location.origin}/protocolo?codigo=${encodeURIComponent(protocolo)}`;
    const text = `Meu registro no FISCALIZE. Protocolo: ${protocolo}`;
    trackPulsoEvent('protocolo_share', attribution);
    if (navigator.share) await navigator.share({ title: 'FISCALIZE Manaus', text, url });
    else await navigator.clipboard?.writeText(`${text}\n${url}`);
  };

  if (publicIntake === false) {
    return <div className="mx-auto max-w-xl py-8 sm:py-14"><div className="surface-card p-6 sm:p-8"><span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-800">Registros ainda não estão abertos</span><h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#0b1f33]">Em breve você poderá registrar problemas por aqui.</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Estamos terminando os testes antes de abrir o formulário ao público. Se você já recebeu um protocolo, pode acompanhar normalmente.</p><Link to="/protocolo" className="secondary-button mt-6 w-full">Acompanhar protocolo</Link></div></div>;
  }

  if (protocolo) {
    return <div className="mx-auto max-w-2xl py-5 sm:py-10"><div className="surface-card overflow-hidden p-6 text-center sm:p-9"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eaf8f3] text-[#15956f]"><CheckCircle2 className="h-8 w-8" /></span><h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] text-[#0b1f33]">Pronto. Seu registro foi enviado.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">Guarde este protocolo. Você vai usar esse código para acompanhar as atualizações.</p><div className="mt-6 rounded-2xl bg-[#0b1f33] px-4 py-5 font-mono text-xl font-bold tracking-wide text-white break-all sm:text-2xl">{protocolo}</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyProtocol} className="secondary-button px-3">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copiado' : 'Copiar código'}</button><button onClick={shareProtocol} className="secondary-button px-3"><Share2 className="h-4 w-4" />Compartilhar</button></div><div className="mt-5 grid gap-3 sm:flex sm:justify-center"><Link to={`/protocolo?codigo=${encodeURIComponent(protocolo)}`} className="primary-button min-h-14 px-6 text-base">Ver andamento <ArrowRight className="h-4 w-4" /></Link><button onClick={() => setProtocolo(null)} className="secondary-button min-h-14 px-6 text-base">Registrar outro</button></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-3xl py-2 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-wrap gap-2"><span className="section-kicker rounded-full border border-[#cfeee2] bg-[#eaf8f3] px-3 py-1.5"><FileText className="h-3.5 w-3.5" /> Novo registro</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200"><Clock3 className="h-3.5 w-3.5" /> leva poucos minutos</span></div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#0b1f33] sm:text-4xl">Conte o que está acontecendo.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">Preencha o essencial para localizar e entender o problema. Seu contato e a foto são opcionais.</p>
      </div>

      <form onSubmit={handleSubmit} className="surface-card space-y-6 p-5 sm:p-8">
        {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{error}</div>}
        <label className="block">
          <span className="text-sm font-bold text-[#0b1f33]">Faixa etária</span>
          <select name="faixa_etaria" value={form.faixa_etaria} onChange={handleChange} required className="field">
            <option value="">Selecione</option>
            <option value="UNDER_16">Menos de 16 anos</option>
            <option value="AGE_16_17">16 a 17 anos</option>
            <option value="AGE_18_PLUS">18 anos ou mais</option>
          </select>
          <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">Pedimos apenas a faixa etária para aplicar as proteções adequadas. O envio autônomo de demandas começa aos 16 anos.</span>
        </label>
        {form.faixa_etaria === "UNDER_16" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Você pode consultar o conteúdo público do FISCALIZE, mas o envio autônomo de demandas está disponível a partir de 16 anos.</div>}
        {form.faixa_etaria === "AGE_16_17" && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900"><strong>Proteção reforçada:</strong> seu registro terá tratamento mais restrito. Evite informar escola, endereço residencial, dados de saúde, documentos ou outras informações pessoais que não sejam necessárias.</div>}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-bold text-[#0b1f33]">Seu nome</span><input name="nome_solicitante" value={form.nome_solicitante} onChange={handleChange} autoComplete="name" required className="field" placeholder="Digite seu nome" /></label>
          <label className="block"><span className="text-sm font-bold text-[#0b1f33]">Bairro ou localidade</span><input name="bairro" value={form.bairro} onChange={handleChange} autoComplete="address-level3" required className="field" placeholder="Ex.: Cidade Nova" /><span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> Manaus</span></label>
        </div>
        <label className="block"><span className="text-sm font-bold text-[#0b1f33]">Que tipo de problema é?</span><select name="categoria" value={form.categoria} onChange={handleChange} required className="field">{categorias.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block"><span className="text-sm font-bold text-[#0b1f33]">O que aconteceu?</span><textarea name="descricao" value={form.descricao} onChange={handleChange} required rows={5} className="field min-h-36 leading-relaxed" placeholder="Explique o problema e diga onde ele está. Se puder, informe há quanto tempo acontece." /></label>
        <div><span className="text-sm font-bold text-[#0b1f33]">Foto <span className="font-normal text-slate-500">(opcional)</span></span><label className="mt-2 flex min-h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-[#b7cad7] bg-[#f6f9fb] px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-[#65a8a1] hover:bg-[#eef8f5]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0f766e] shadow-sm"><Camera className="h-4.5 w-4.5" /></span>{photoBusy ? 'Preparando foto...' : photoName || 'Tirar foto ou escolher da galeria'}<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={photoBusy || form.faixa_etaria === "UNDER_16"} className="sr-only" /></label>{photoName && <p className="mt-2 text-xs font-semibold text-[#0f766e]">Foto pronta para envio.</p>}</div>
        <label className="block"><span className="text-sm font-bold text-[#0b1f33]">Contato <span className="font-normal text-slate-500">(opcional)</span></span><input name="contato" value={form.contato} onChange={handleChange} autoComplete="tel" placeholder="Telefone ou e-mail, se quiser receber retorno" className="field" /></label>
        <input type="hidden" name="municipio" value={form.municipio} /><input type="hidden" name="prioridade" value={form.prioridade} />
        <div className="rounded-2xl border border-[#cfeee2] bg-[#eaf8f3] p-4 sm:p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0f766e]" /><div className="space-y-3"><p className="text-xs leading-relaxed text-[#285e59] sm:text-sm">Evite colocar na descrição informações pessoais que não sejam necessárias para explicar o problema.</p><label className="flex cursor-pointer items-start gap-3 text-sm text-[#164e49]"><input type="checkbox" name="aviso_privacidade_aceito" checked={form.aviso_privacidade_aceito} onChange={handleChange} className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#65a8a1]" required /><span>Entendi que meus dados serão usados para registrar e acompanhar este caso. <Link to="/privacidade" className="font-extrabold underline">Ver privacidade</Link>.</span></label></div></div></div>
        <button disabled={loading || photoBusy || form.faixa_etaria === "UNDER_16"} className="primary-button min-h-14 w-full text-base disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Enviando..." : "Enviar e gerar protocolo"}<ArrowRight className="h-5 w-5" /></button>
        <p className="text-center text-xs leading-relaxed text-slate-500">O FISCALIZE é uma iniciativa independente para registrar, organizar e acompanhar problemas relatados por moradores.</p>
      </form>
    </div>
  );
}
