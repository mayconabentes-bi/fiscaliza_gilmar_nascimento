import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, TrendingUp, ArrowRight, MapPin, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TemaEmergente {
  area_tematica: string;
  municipio: string;
  total_recentes: number;
  destinatario_final: string;
}

export default function EmergingThemesAlert() {
  const [temas, setTemas] = useState<TemaEmergente[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchTemas = async () => {
      try {
        const res = await fetch("/api/analytics/temas-emergentes");
        if (res.ok) {
          const data = await res.json();
          setTemas(data);
        }
      } catch (error) {
        console.error("Erro ao carregar temas emergentes", error);
      }
    };

    fetchTemas();
    // Poll every minute
    const interval = setInterval(fetchTemas, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (temas.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % temas.length);
    }, 5000); // Rotate every 5 seconds
    return () => clearInterval(timer);
  }, [temas.length]);

  if (temas.length === 0) return null;

  const currentTheme = temas[currentIndex];

  return (
    <div className="w-full bg-amber-50 border-b border-amber-100 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 text-amber-700 font-bold whitespace-nowrap">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Temas Emergentes:</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 text-sm text-amber-900 truncate"
            >
              <span className="font-bold">{currentTheme.area_tematica}</span>
              <span className="text-amber-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {currentTheme.municipio}
              </span>
              <span className="hidden md:flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                <TrendingUp className="w-3 h-3" /> {currentTheme.total_recentes} interações recentes
              </span>
              <span className="hidden lg:flex items-center gap-1 text-slate-500 text-xs">
                <ArrowRight className="w-3 h-3" /> Enviado para: <Building2 className="w-3 h-3" /> {currentTheme.destinatario_final}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <Link to="/propostas" className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap ml-4 flex items-center gap-1">
          Ver detalhes <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
