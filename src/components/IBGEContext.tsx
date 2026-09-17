import React, { useEffect, useState } from 'react';
import { Info, BarChart3, Users } from 'lucide-react';

interface IBGEMunicipio {
  id: string;
  nome: string;
  microrregiao: string;
  mesorregiao: string;
  populacao_estimada: number | null;
  pib: number | null;
}

interface IBGEStats {
  total_municipios: number;
  populacao_total: number | null;
  pib_medio: number | null;
}

export const IBGEContext: React.FC<{ municipioNome?: string }> = ({ municipioNome }) => {
  const [municipio, setMunicipio] = useState<IBGEMunicipio | null>(null);
  const [stats, setStats] = useState<IBGEStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch global stats
        const statsRes = await fetch('/api/ibge/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Fetch specific municipality if name provided
        if (municipioNome) {
          const munsRes = await fetch('/api/ibge/municipios');
          if (munsRes.ok) {
            const muns: IBGEMunicipio[] = await munsRes.json();
            const found = muns.find(m => m.nome.toLowerCase() === municipioNome.toLowerCase());
            if (found) {
              setMunicipio(found);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching IBGE data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [municipioNome]);

  if (loading) return <div className="animate-pulse h-24 bg-gray-100 rounded-xl"></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Info size={20} />
          </div>
          <h3 className="font-medium text-gray-900">Contexto Territorial</h3>
        </div>
        {municipio ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Município: <span className="text-gray-900 font-medium">{municipio.nome}</span></p>
            <p className="text-sm text-gray-500">Microrregião: <span className="text-gray-900">{municipio.microrregiao}</span></p>
            <p className="text-sm text-gray-500">Mesorregião: <span className="text-gray-900">{municipio.mesorregiao}</span></p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Selecione um município para ver detalhes territoriais oficiais do IBGE.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Users size={20} />
          </div>
          <h3 className="font-medium text-gray-900">Demografia (IBGE)</h3>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">População Estimada: 
            <span className="text-gray-900 font-medium ml-1">
              {municipio?.populacao_estimada ? municipio.populacao_estimada.toLocaleString() : 'N/A'}
            </span>
          </p>
          <p className="text-sm text-gray-500">Estado (AM): 
            <span className="text-gray-900 ml-1">
              {stats?.populacao_total ? stats.populacao_total.toLocaleString() : '...'}
            </span>
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <BarChart3 size={20} />
          </div>
          <h3 className="font-medium text-gray-900">Economia (PIB)</h3>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">PIB Municipal (R$ mil): 
            <span className="text-gray-900 font-medium ml-1">
              {municipio?.pib ? municipio.pib.toLocaleString() : 'N/A'}
            </span>
          </p>
          <p className="text-sm text-gray-500">Média Estadual: 
            <span className="text-gray-900 ml-1">
              {stats?.pib_medio ? Math.round(stats.pib_medio).toLocaleString() : '...'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
