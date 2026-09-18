import { Link } from "react-router-dom";
import { KeyRound, MapPin, ShieldCheck, UserRound } from "lucide-react";

const ageLabels: Record<string, string> = {
  AGE_16_17: "16 a 17 anos",
  AGE_18_24: "18 a 24 anos",
  AGE_25_34: "25 a 34 anos",
  AGE_35_44: "35 a 44 anos",
  AGE_45_59: "45 a 59 anos",
  AGE_60_PLUS: "60 anos ou mais",
};

export default function PerfilCidadao({ user }: { user: any }) {
  return (
    <div className="mx-auto max-w-3xl pb-8">
      <section className="py-2 sm:py-4">
        <span className="section-kicker">Minha conta</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Perfil</h1>
        <p className="mt-2 text-sm leading-6 text-[#657089]">Confira os dados básicos vinculados à sua conta FISCALIZE.</p>
      </section>

      <section className="surface-card mt-5 p-5 sm:p-7">
        <div className="flex items-center gap-3 border-b border-[#edf0f6] pb-5">
          <span className="icon-tile"><UserRound className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-[#172033]">{user?.nome_completo || "Pessoa usuária"}</p>
            <p className="truncate text-sm text-[#657089]">{user?.email || "E-mail não disponível"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#f7f9fd] p-4">
            <MapPin className="h-4 w-4 text-[#1f2e6e]" />
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Localidade</p>
            <p className="mt-1 text-sm font-semibold text-[#34425b]">{[user?.bairro, user?.municipio].filter(Boolean).join(" · ") || "Não informada"}</p>
          </div>
          <div className="rounded-2xl bg-[#f7f9fd] p-4">
            <ShieldCheck className="h-4 w-4 text-[#1f2e6e]" />
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Faixa etária</p>
            <p className="mt-1 text-sm font-semibold text-[#34425b]">{ageLabels[user?.faixa_etaria] || "Não informada"}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        <Link to="/recuperar-acesso" className="surface-card flex min-h-16 items-center gap-3 p-4">
          <span className="icon-tile"><KeyRound className="h-4 w-4" /></span>
          <span><strong className="block text-sm text-[#172033]">Senha e acesso</strong><span className="mt-1 block text-xs text-[#657089]">Use a recuperação de acesso para redefinir sua senha.</span></span>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/privacidade" className="secondary-button min-h-12 justify-center px-3 text-sm">Privacidade</Link>
          <Link to="/termos" className="secondary-button min-h-12 justify-center px-3 text-sm">Termos</Link>
        </div>
      </section>
    </div>
  );
}
