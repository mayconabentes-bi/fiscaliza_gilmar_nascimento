import React, { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

type CepPreview = {
  cep: string;
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
};

export default function RegisterCidadao() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    municipio: "Manaus",
    bairro: "",
    password: "",
    faixa_etaria: "",
    aceite_codigo: false,
    aceite_lgpd: false,
  });
  const [error, setError] = useState("");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [cepPreview, setCepPreview] = useState<CepPreview | null>(null);
  const cepRequestId = useRef(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" && e.target instanceof HTMLInputElement ? e.target.checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const lookupCep = async () => {
    const normalized = cep.replace(/\D/g, "");
    const requestId = ++cepRequestId.current;
    setCepMessage("");
    setCepPreview(null);

    if (normalized.length !== 8) {
      setCepMessage("Informe um CEP válido com 8 dígitos.");
      return;
    }

    setCepLoading(true);
    try {
      const res = await fetch(`/api/localizacao/cep/${normalized}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível buscar o CEP.");
      if (requestId !== cepRequestId.current || cep.replace(/\D/g, "") !== normalized) return;

      const preview: CepPreview = {
        cep: String(data.cep || formatCep(normalized)),
        logradouro: String(data.logradouro || "").trim(),
        bairro: String(data.bairro || "").trim(),
        municipio: String(data.municipio || "").trim(),
        uf: String(data.uf || "").trim().toUpperCase(),
      };

      setFormData((prev) => ({
        ...prev,
        municipio: preview.municipio || prev.municipio,
        bairro: preview.bairro || prev.bairro,
      }));
      setCep(preview.cep);
      setCepPreview(preview);

      if (!preview.logradouro || !preview.bairro) {
        setCepMessage("CEP localizado, mas o cadastro postal é genérico ou incompleto. Confira e complete bairro/localidade manualmente.");
      } else {
        setCepMessage("Endereço localizado. Confira os dados antes de continuar.");
      }
    } catch (err: any) {
      if (requestId !== cepRequestId.current) return;
      setCepPreview(null);
      setCepMessage(err.message || "Consulta de CEP indisponível. Preencha município e bairro manualmente.");
    } finally {
      if (requestId === cepRequestId.current) setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.faixa_etaria) {
      setError("Informe sua faixa etária para continuar.");
      return;
    }
    if (formData.faixa_etaria === "UNDER_16") {
      setError("A criação autônoma de conta no FISCALIZE está disponível a partir de 16 anos.");
      return;
    }
    if (!formData.aceite_codigo || !formData.aceite_lgpd) {
      setError("Confirme as regras de uso e a política de privacidade para continuar.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register/cidadao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível criar sua conta.");
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "Não foi possível criar sua conta.");
    }
  };

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-12">
      <div className="surface-card p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950">Criar conta</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Pedimos apenas o necessário para identificar sua conta e organizar sua participação. Não solicitamos data de nascimento, CPF, RG ou biometria.</p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <label className="block"><span className="text-sm font-bold">Nome</span><input name="nome_completo" value={formData.nome_completo} onChange={handleChange} autoComplete="name" required className="field" /></label>
          <label className="block"><span className="text-sm font-bold">E-mail</span><input name="email" type="email" value={formData.email} onChange={handleChange} autoComplete="email" required className="field" /></label>
          <label className="block">
            <span className="text-sm font-bold">Faixa etária</span>
            <select name="faixa_etaria" value={formData.faixa_etaria} onChange={handleChange} required className="field">
              <option value="">Selecione</option>
              <option value="UNDER_16">Menos de 16 anos</option>
              <option value="AGE_16_17">16 a 17 anos</option>
              <option value="AGE_18_24">18 a 24 anos</option>
              <option value="AGE_25_34">25 a 34 anos</option>
              <option value="AGE_35_44">35 a 44 anos</option>
              <option value="AGE_45_59">45 a 59 anos</option>
              <option value="AGE_60_PLUS">60 anos ou mais</option>
            </select>
            <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">Usamos somente a faixa etária para aplicar as proteções adequadas. A participação autônoma começa aos 16 anos.</span>
          </label>
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <span className="text-sm font-bold">Localização</span>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Use o CEP para conferir logradouro, município e bairro. O CEP e o logradouro consultado não são armazenados na sua conta.</p>
            </div>
            <div className="flex gap-2">
              <input
                name="cep"
                value={cep}
                onChange={(e) => {
                  cepRequestId.current += 1;
                  setCep(formatCep(e.target.value));
                  setCepPreview(null);
                  setCepMessage("");
                }}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="CEP"
                aria-label="CEP"
                className="field min-w-0 flex-1"
              />
              <button type="button" onClick={() => void lookupCep()} disabled={cepLoading || cep.replace(/\D/g, "").length !== 8} className="secondary-button min-h-12 shrink-0 px-4 disabled:opacity-50">
                {cepLoading ? "Buscando..." : "Buscar CEP"}
              </button>
            </div>
            {cepMessage && <p role="status" className="text-xs leading-relaxed text-slate-600">{cepMessage}</p>}
            {cepPreview && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600" data-cep-preview="full-address">
                <strong className="block text-slate-800">Endereço consultado</strong>
                <span className="mt-1 block">{cepPreview.logradouro || "Logradouro não informado para este CEP"}</span>
                <span className="block">{cepPreview.bairro || "Bairro não informado"} · {cepPreview.municipio || "Município não informado"}{cepPreview.uf ? `/${cepPreview.uf}` : ""}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-bold">Município</span><input name="municipio" value={formData.municipio} onChange={handleChange} autoComplete="address-level2" required className="field" /></label>
              <label className="block"><span className="text-sm font-bold">Bairro</span><input name="bairro" value={formData.bairro} onChange={handleChange} autoComplete="address-level3" required className="field" /></label>
            </div>
          </div>
          <label className="block"><span className="text-sm font-bold">Senha</span><input name="password" type="password" value={formData.password} onChange={handleChange} autoComplete="new-password" minLength={8} required className="field" /></label>

          {formData.faixa_etaria === "AGE_16_17" && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900"><strong>Proteção reforçada:</strong> participantes de 16 e 17 anos têm tratamento mais restrito de dados e conteúdo. A participação não pode ser usada para perfil político, propaganda eleitoral ou inferência de preferência.</div>}

          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <label className="flex items-start gap-3 text-sm"><input name="aceite_codigo" type="checkbox" checked={formData.aceite_codigo} onChange={handleChange} className="mt-0.5 h-5 w-5" required /><span>Concordo em usar o FISCALIZE com respeito, sem abuso e sem informações falsas, conforme os <Link to="/termos" className="font-bold underline">Termos de Uso</Link>.</span></label>
            <label className="flex items-start gap-3 text-sm"><input name="aceite_lgpd" type="checkbox" checked={formData.aceite_lgpd} onChange={handleChange} className="mt-0.5 h-5 w-5" required /><span>Li a <Link to="/privacidade" className="font-bold underline">Política de Privacidade</Link> e entendi como os dados necessários para a conta serão tratados.</span></label>
          </div>

          <button type="submit" disabled={formData.faixa_etaria === "UNDER_16"} className="primary-button min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50">Criar conta</button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">Já tem uma conta? <Link to="/login" className="font-bold text-emerald-700">Entrar</Link></p>
      </div>
    </div>
  );
}
