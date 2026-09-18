export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function pickField(item: Record<string, unknown>, candidates: string[]) {
  const direct = candidates.find((key) => item[key] != null && String(item[key]).trim());
  if (direct) return item[direct];
  const wanted = new Set(candidates.map(normalizeText));
  const dynamic = Object.keys(item).find((key) => wanted.has(normalizeText(key)));
  return dynamic ? item[dynamic] : undefined;
}

export function neighborhoodValue(item: Record<string, unknown>) {
  const value = pickField(item, ["BAIRRO", "NM_BAIRRO", "NOME_BAIRR", "NOME_BAIRRO", "NOMEBAIRRO", "BAIRRO_NOME", "DS_BAIRRO", "bairro", "nome_bairro"]);
  if (value != null && String(value).trim()) return String(value).trim();
  const dynamic = Object.keys(item).find((key) => normalizeText(key).includes("BAIRRO"));
  return dynamic && item[dynamic] != null ? String(item[dynamic]).trim() : "";
}

export function coordinatesFrom(item: Record<string, unknown>) {
  const lat = Number(pickField(item, ["latitude", "lat", "LATITUDE", "LAT", "nu_latitude"]));
  const lon = Number(pickField(item, ["longitude", "lon", "lng", "LONGITUDE", "LONG", "nu_longitude"]));
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

export function pointInRing(point: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0]), yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]), yj = Number(ring[j]?.[1]);
    const intersects = ((yi > point[1]) !== (yj > point[1])) && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: [number, number], rings: number[][][]) {
  if (!rings.length || !pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) if (pointInRing(point, rings[i])) return false;
  return true;
}

export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (v: number) => v * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function collectionFrom(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ["results", "data", "dados", "items", "content", "features"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}
