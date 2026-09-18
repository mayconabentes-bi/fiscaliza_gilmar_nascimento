import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, User } from "lucide-react";

export default function Login({ setUser }: { setUser: (user: any) => void }) {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("admin") === "1" ? "admin" : "cidadao";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState<"cidadao" | "admin">(initialType);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectType = (nextType: "cidadao" | "admin") => {
    setType(nextType);
    setPassword("");
    setShowPassword(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const endpoint = type === "admin" ? "/api/auth/admin/login" : "/api/auth/login";
      const body = type === "admin" ? { email: normalizedEmail, password } : { email: normalizedEmail, password, type: "cidadao" };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : {};
      if (!res.ok) {
        if (res.status === 401) throw new Error("E-mail ou senha inválidos.");
        if (res.status === 429) throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        if (!contentType.includes("application/json") || res.status >= 500) {
          throw new Error(data.error || "Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
        }
        throw new Error(data.error || "Não foi possível entrar.");
      }
      if (!data?.user) throw new Error("Resposta inválida do serviço de autenticação.");

      const authenticatedUser = type === "admin" ? data.user : { ...data.user, type: "cidadao" };
      localStorage.setItem("user", JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      navigate(type === "admin" ? "/dashboard" : "/meus-registros");
    } catch (err: any) {
      setError(err?.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-3 sm:py-14" data-login-mode={type}>
      <div className="text-center">
        <span className="brand-signature-mark brand-signature-mark--login hidden sm:inline-flex" aria-hidden="true"><img src="/brand/gilmar-nascimento-oficial.png" alt="" /></span>
        <span className="mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e0f2] bg-white text-[#1f2e6e] shadow-sm sm:mt-2 sm:h-11 sm:w-11"><ShieldCheck className="h-5 w-5" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:mt-5">
          <span className="sm:hidden">{type === "admin" ? "Acesso administrativo" : "Entrar"}</span>
          <span className="hidden sm:inline">Entrar no FISCALIZE</span>
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#657089]">
          <span className="sm:hidden">{type === "admin" ? "Área restrita a usuários autorizados." : "Acesse seus registros e sua conta."}</span>
          <span className="hidden sm:inline">Acesse sua conta ou o núcleo privado.</span>
        </p>
      </div>

      <section className="surface-card mt-5 overflow-hidden p-4 sm:mt-8 sm:p-7">
        <div className="-mx-4 -mt-4 mb-4 h-1 bg-[#f36a10] sm:-mx-7 sm:-mt-7 sm:mb-5" aria-hidden="true" />

        <div className="hidden grid-cols-2 gap-1 rounded-xl bg-[#eef2fb] p-1 sm:grid" role="group" aria-label="Tipo de acesso">
          <button type="button" aria-pressed={type === "cidadao"} onClick={() => selectType("cidadao")} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition ${type === "cidadao" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}><span className="flex items-center justify-center gap-2"><User className="h-4 w-4" /> Pessoa</span></button>
          <button type="button" aria-pressed={type === "admin"} onClick={() => selectType("admin")} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition ${type === "admin" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}><span className="flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4" /> Administrador</span></button>
        </div>

        {type === "admin" && (
          <div className="mb-4 flex items-start justify-between gap-3 sm:mb-0 sm:mt-4">
            <p className="text-xs leading-5 text-[#657089]">Acesso privado. Não existe cadastro de administrador pela aplicação.</p>
            <button type="button" onClick={() => selectType("cidadao")} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-[#1f2e6e] sm:hidden"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          </div>
        )}

        <form className="mt-4 space-y-4 sm:mt-6 sm:space-y-5" onSubmit={handleSubmit}>
          {error && <div role="alert" data-login-error className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm leading-6 text-red-700">{error}</div>}
          <label className="block">
            <span className="text-sm font-bold text-[#34425b]">E-mail</span>
            <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} className="field text-base" placeholder="voce@exemplo.com" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#34425b]">Senha</span>
            <span className="relative mt-1 block">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-0 pr-12 text-base" placeholder="Sua senha" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#657089] hover:bg-[#eef2fb]">
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </span>
          </label>

          {type === "cidadao" && (
            <div className="flex flex-col gap-2 text-sm font-bold text-[#1f2e6e] sm:flex-row sm:items-center sm:justify-between">
              <Link to="/recuperar-acesso?modo=senha" className="min-h-11 inline-flex items-center underline decoration-[#f36a10] decoration-2 underline-offset-4">Esqueci minha senha</Link>
              <Link to="/recuperar-acesso?modo=email" className="min-h-11 inline-flex items-center underline decoration-[#f36a10] decoration-2 underline-offset-4">Não lembro meu e-mail</Link>
            </div>
          )}

          <button type="submit" disabled={loading} className="primary-button min-h-14 w-full text-base">
            {loading ? "Entrando..." : type === "admin" ? "Entrar na área privada" : "Entrar"}
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </form>

        {type === "cidadao" && (
          <div className="mt-5 border-t border-[#eef2fb] pt-5 text-center">
            <p className="text-sm font-bold text-[#34425b]">Ainda não tem conta?</p>
            <p className="mt-1 text-xs leading-5 text-[#657089]">A conta é opcional para registrar ocorrências e facilita acompanhar seus próprios registros.</p>
            <Link to="/register-cidadao" className="secondary-button mt-3 min-h-12 w-full justify-center text-sm">Criar conta</Link>
          </div>
        )}

        {type === "cidadao" && (
          <button type="button" onClick={() => selectType("admin")} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-t border-[#eef2fb] pt-4 text-sm font-extrabold text-[#526078] sm:hidden">
            <ShieldCheck className="h-4 w-4" /> Acesso administrativo
          </button>
        )}
      </section>
    </div>
  );
}
