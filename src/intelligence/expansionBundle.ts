import {
  loadIbgePopulation,
  loadInepCensoEscolar,
  loadSiconfi,
} from "./expansionSources.js";
import { loadCnesManausFull } from "./cnesFull.js";
import { loadPncpManausContracts } from "./pncpManaus.js";

export async function loadCanonicalExpansionSources() {
  const [ibge, siconfi, pncpRaw, cnesRaw, inep] = await Promise.all([
    loadIbgePopulation(),
    loadSiconfi(),
    loadPncpManausContracts(),
    loadCnesManausFull(),
    loadInepCensoEscolar(),
  ]);

  // Mantém as chaves históricas usadas por health/snapshots/UI, mas com os
  // adapters canônicos validados pelo Q/A profundo.
  const pncp = {
    ...pncpRaw,
    source: "pncp_contratos",
    provenance: { ...pncpRaw.provenance, source: "pncp_contratos" },
  };
  const cnes = {
    ...cnesRaw,
    source: "cnes_datasus_catalogo",
    provenance: { ...cnesRaw.provenance, source: "cnes_datasus_catalogo" },
  };

  return { ibge, siconfi, pncp, cnes, inep };
}
