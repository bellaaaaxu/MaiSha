import { normalizeName } from '@/utils/normalize-name';
import type { StoreTypeKeyword, StoreSearchResult, RankedStore } from '@/types/store-finder';

export interface LatLng { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function selectSearchTerms(keywords: StoreTypeKeyword[], max = 4): string[] {
  const sorted = [...keywords].sort((a, b) => a.tier - b.tier);
  const primary = sorted.filter((k) => k.tier <= 2).map((k) => k.term);
  const terms = primary.length ? primary : sorted.map((k) => k.term);
  return [...new Set(terms)].slice(0, max);
}

export function dedupeAndRank(raw: StoreSearchResult[], user: LatLng): RankedStore[] {
  const kept: RankedStore[] = [];
  for (const r of raw) {
    const isDup = kept.some(
      (k) =>
        normalizeName(k.name) === normalizeName(r.name) &&
        haversineMeters({ lat: k.lat, lng: k.lng }, { lat: r.lat, lng: r.lng }) < 50
    );
    if (isDup) continue;
    kept.push({ ...r, distanceMeters: haversineMeters(user, { lat: r.lat, lng: r.lng }) });
  }
  kept.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return kept;
}
