import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function LGPDConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("pulso_privacy_notice_seen");
    if (!seen) {
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acknowledge = () => {
    localStorage.setItem("pulso_privacy_notice_seen", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div data-privacy-notice className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-2 right-2 z-50 lg:bottom-5 lg:left-auto lg:right-5 lg:w-[420px]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Sobre sua privacidade</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-600">Usamos recursos necessários para o site funcionar. <Link to="/privacidade" onClick={acknowledge} className="font-bold text-[#1f2e6e] underline">Ver privacidade</Link>.</p>
          </div>
          <button onClick={acknowledge} className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-extrabold text-[#1f2e6e]">Entendi</button>
        </div>
      </div>
    </div>
  );
}
