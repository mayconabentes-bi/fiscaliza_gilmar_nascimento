import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { Link } from "react-router-dom";

export default function LGPDConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("pulso_privacy_notice_seen");
    if (!seen) {
      const timer = setTimeout(() => setIsVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const acknowledge = () => {
    localStorage.setItem("pulso_privacy_notice_seen", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-3 z-50 md:bottom-5 md:left-auto md:right-5 md:w-[430px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-700"><Info className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Sobre sua privacidade</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Usamos recursos necessários para o site funcionar. Se você registrar um problema, explicamos ali como os dados serão usados.</p>
            <div className="mt-2 flex items-center gap-4 text-xs font-bold">
              <button onClick={acknowledge} className="min-h-9 text-emerald-700">Entendi</button>
              <Link to="/privacidade" onClick={() => setIsVisible(false)} className="min-h-9 inline-flex items-center text-slate-600 underline">Ver detalhes</Link>
            </div>
          </div>
          <button onClick={() => setIsVisible(false)} aria-label="Fechar aviso" className="min-h-9 min-w-9 inline-flex items-center justify-center text-slate-400"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
