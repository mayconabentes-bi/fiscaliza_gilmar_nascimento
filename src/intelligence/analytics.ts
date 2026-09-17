import { getDb } from "../server/db.js";
import { coordinatesFrom, haversineMeters, neighborhoodValue, normalizeText, pointInPolygon } from "./normalization.js";
import type { IntelligenceIndicator, TerritoryRecord } from "./types.js";

function featureAttrs(feature: any) {
  return feature?.attributes || feature || {};
}

function featureCoords(feature: any) {
  const attrs = featureAttrs(feature);
  const attrCoords = coordinatesFrom(attrs);
  if (attrCoords) return attrCoords;
  const geometry = feature?.geometry || {};
  const x = Number(geometry.x), y = Number(geometry.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { lat: y, lon: x } : null;
}

function canonicalNeighborhood(item: any, neighborhoods: any[]) {
  const coords = featureCoords(item);
  if (coords) {
    for (const feature of neighborhoods) {
      const rings = feature?.geometry?.rings;
      if (Array.isArray(rings) && pointInPolygon([coords.lon, coords.lat], rings)) {
        const name = neighborhoodValue(featureAttrs(feature));
        if (name) return name;
      }
    }
  }
  return neighborhoodValue(featureAttrs(item));
}

export function aggregateTerritories(input: {
  neighborhoods: any[];
  works: any[];
  health: any[];
  schools: any[];
}) {
  const map = new Map<string, TerritoryRecord & { themeSet: Set<string> }>();
  const names = new Map<string, string>();

  for (const feature of input.neighborhoods) {
    const name = neighborhoodValue(featureAttrs(feature));
    if (!name) continue;
    const key = normalizeText(name);
    names.set(key, name);
    map.set(key, { bairro: name, demandas: 0, prioritarias: 0, concluidas: 0, taxaConclusao: 0, temas: 0, obras: 0, unidadesSaude: 0, escolas: 0, semClassificacao: 0, themeSet: new Set() });
  }

  const ensure = (bairro: string) => {
    const key = normalizeText(bairro || "Não informado");
    if (!map.has(key)) map.set(key, { bairro: bairro || "Não informado", demandas: 0, prioritarias: 0, concluidas: 0, taxaConclusao: 0, temas: 0, obras: 0, unidadesSaude: 0, escolas: 0, semClassificacao: 0, themeSet: new Set() });
    return map.get(key)!;
  };

  const db = getDb();
  try {
    const demands = db.prepare(`SELECT bairro, COALESCE(bairro_oficial, bairro) bairro_analise, categoria, prioridade, status, latitude, longitude FROM demandas WHERE LOWER(municipio)='manaus'`).all() as any[];
    for (const demand of demands) {
      let bairro = String(demand.bairro_analise || demand.bairro || "").trim();
      if (Number.isFinite(Number(demand.latitude)) && Number.isFinite(Number(demand.longitude))) {
        const pseudo = { attributes: {}, geometry: { x: Number(demand.longitude), y: Number(demand.latitude) } };
        bairro = canonicalNeighborhood(pseudo, input.neighborhoods) || bairro;
      }
      const target = ensure(bairro || "Não informado");
      target.demandas += 1;
      if (["ALTA", "CRITICA"].includes(String(demand.prioridade))) target.prioritarias += 1;
      if (String(demand.status) === "CONCLUIDA") target.concluidas += 1;
      if (demand.categoria) target.themeSet.add(String(demand.categoria));
    }
  } finally { db.close(); }

  for (const [kind, items] of [["obras", input.works], ["unidadesSaude", input.health], ["escolas", input.schools]] as const) {
    for (const item of items) {
      const bairro = canonicalNeighborhood(item, input.neighborhoods);
      if (!bairro) continue;
      ensure(bairro)[kind] += 1;
    }
  }

  return [...map.values()].map(({ themeSet, ...row }) => ({
    ...row,
    temas: themeSet.size,
    taxaConclusao: row.demandas ? Number(((row.concluidas / row.demandas) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.demandas - a.demandas || a.bairro.localeCompare(b.bairro, "pt-BR"));
}

export function derivedIndicators(territories: TerritoryRecord[]): IntelligenceIndicator[] {
  const totalDemandas = territories.reduce((sum, item) => sum + item.demandas, 0);
  const totalConcluidas = territories.reduce((sum, item) => sum + item.concluidas, 0);
  const totalPrioritarias = territories.reduce((sum, item) => sum + item.prioritarias, 0);
  const totalEquip = territories.reduce((sum, item) => sum + item.unidadesSaude + item.escolas, 0);
  const activeTerritories = territories.filter((item) => item.demandas > 0).length;
  return [
    { key: "taxa_conclusao_demandas", label: "Taxa de conclusão de demandas", value: totalDemandas ? Number(((totalConcluidas / totalDemandas) * 100).toFixed(1)) : 0, unit: "percent", methodology: "Demandas concluídas / demandas registradas em Manaus × 100.", sourceKeys: ["demandas_internas"] },
    { key: "participacao_prioritarias", label: "Participação de demandas prioritárias", value: totalDemandas ? Number(((totalPrioritarias / totalDemandas) * 100).toFixed(1)) : 0, unit: "percent", methodology: "Demandas ALTA ou CRÍTICA / demandas registradas em Manaus × 100.", sourceKeys: ["demandas_internas"] },
    { key: "equipamentos_por_territorio_ativo", label: "Equipamentos por território com demanda", value: activeTerritories ? Number((totalEquip / activeTerritories).toFixed(2)) : 0, unit: "ratio", methodology: "Unidades de saúde + escolas / bairros com ao menos uma demanda registrada.", sourceKeys: ["geomanaus_saude", "geomanaus_escolas", "demandas_internas"] },
  ];
}

export function nearbyResources(input: { demand: any; works: any[]; health: any[]; schools: any[]; radiusMeters: number }) {
  const point = Number.isFinite(Number(input.demand?.latitude)) && Number.isFinite(Number(input.demand?.longitude))
    ? { lat: Number(input.demand.latitude), lon: Number(input.demand.longitude) }
    : null;
  if (!point) return { geocoded: false, radiusMeters: input.radiusMeters, works: [], health: [], schools: [] };
  const map = (items: any[]) => items.flatMap((item) => {
    const coords = featureCoords(item);
    if (!coords) return [];
    const distanceMeters = Math.round(haversineMeters(point, coords));
    return distanceMeters <= input.radiusMeters ? [{ distanceMeters, attributes: featureAttrs(item) }] : [];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 50);
  return { geocoded: true, radiusMeters: input.radiusMeters, works: map(input.works), health: map(input.health), schools: map(input.schools) };
}
