import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, FileText, MapPin, Tag, Clock, TrendingUp, ShieldCheck } from "lucide-react";

export default function TemasConsolidados() {
  const [temas, setTemas] = useState<any[]>([]);
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/dashboard", {
      headers: {
        'x-municipality-id': 'mun-manaus-01' // Default for demo
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
      })
      .then((data) => {
        setTemas(data.temas || []);
        setIndicadores(data.indicadores || []);
      })
      .catch(err => {
        console.error(err);
        setTemas([]);
        setIndicadores([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Temas Consolidados & Indicadores</h1>
          <p className="mt-2 text-slate-600">
            Acompanhe as contribuições cívicas agregadas e os indicadores de transparência municipal.
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {/* Indicadores Municipais */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Índice de Transparência por Município e Área
          </h2>
          
          {indicadores.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              Nenhum indicador processado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {indicadores.map((ind) => (
                <div key={ind.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-slate-400" /> {ind.municipio}
                      </h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3" /> {ind.area_tematica.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-600">
                        {(ind.indice_transparencia * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Transparência</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{ind.total_publicacoes}</div>
                      <div className="text-xs text-slate-500">Publicações</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{ind.total_temas}</div>
                      <div className="text-xs text-slate-500">Temas</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Temas Agregados */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Temas Mais Recorrentes
          </h2>
          
          {temas.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              Nenhum tema agregado ainda.
            </div>
          ) : (
            <div className="grid gap-6">
              {temas.map((tema) => (
                <div key={tema.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium uppercase">
                        {tema.area_tematica.replace(/_/g, ' ')}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="w-3 h-3" /> {tema.municipio}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 capitalize">
                      {tema.titulo_normalizado}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" /> {tema.total_publicacoes} contribuições
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Atualizado em {new Date(tema.updated_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-center min-w-[120px]">
                    <div className="text-2xl font-bold">{tema.score_recorrencia.toFixed(1)}x</div>
                    <div className="text-xs font-medium uppercase tracking-wider mt-1">Score Recorrência</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
