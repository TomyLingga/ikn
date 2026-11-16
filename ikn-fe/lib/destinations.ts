// World seaports and large airports for the CIF destination picker (suggestions while typing, nearest match on map click).
// The public Nominatim service forbids autocomplete, so suggestions come from this local list; Nominatim stays behind
// the explicit "search the map" button. Data in lib/data/destinations.json, rows [name, countryCode, lat, lng, code]:
//   ports    = github.com/marchah/sea-ports (MIT), code = UN/LOCODE. Coordinates are often the port city centre,
//              so the pin stays draggable and the customer can correct it.
//   airports = OurAirports "large_airport" rows with an IATA code (public domain), code = IATA.
import type { Lang } from '@/lib/types';

export type DestinationKind = 'port' | 'airport';

export interface Destination {
  kind: DestinationKind;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** UN/LOCODE for ports, IATA for airports. */
  code: string;
}

type Row = [string, string, number, number, string];

let cache: Destination[] | null = null;
let pending: Promise<Destination[]> | null = null;

/** Loads the list once per browser session (separate chunk, only fetched when the picker mounts). */
export function loadDestinations(): Promise<Destination[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('@/lib/data/destinations.json')
      .then((mod) => {
        const data = mod.default as unknown as { ports: Row[]; airports: Row[] };
        const rows = (kind: DestinationKind) => (row: Row): Destination => ({ kind, name: row[0], countryCode: row[1], lat: row[2], lng: row[3], code: row[4] });
        cache = [...data.ports.map(rows('port')), ...data.airports.map(rows('airport'))];
        return cache;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const PORT_WORDS = new Set(['port', 'seaport', 'harbour', 'harbor', 'pelabuhan']);
const AIRPORT_WORDS = new Set(['airport', 'bandara', 'bandar', 'udara']);
const FILLER_WORDS = new Set(['of', 'the', 'di', 'de']);

/** Name written into the "port name" field: airports carry their IATA code, ports keep the UN/LOCODE place name. */
export function destinationLabel(d: Destination): string {
  return d.kind === 'airport' ? `${d.name} (${d.code})` : d.name;
}

export function destinationKindLabel(kind: DestinationKind, lang: Lang): string {
  if (kind === 'airport') return lang === 'en' ? 'Airport' : 'Bandara';
  return lang === 'en' ? 'Seaport' : 'Pelabuhan';
}

interface SearchOptions {
  /** Country chosen in the form: its entries rank first. */
  countryCode?: string;
  /** Country names (any language) for a code, so "china" or "tiongkok" lists that country's ports. */
  countryTerms?: (code: string) => string;
  limit?: number;
}

/**
 * Every word typed must match the name, code or country. "port"/"pelabuhan" and "airport"/"bandara" only steer
 * the kind ("port of shanghai" finds Shanghai the seaport first); a name that itself contains the word still matches.
 */
export function searchDestinations(list: Destination[], query: string, options: SearchOptions = {}): Destination[] {
  const { countryCode = '', countryTerms, limit = 8 } = options;
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
  let wantKind: DestinationKind | null = null;
  const terms: string[] = [];
  for (const word of words) {
    if (PORT_WORDS.has(word)) wantKind = wantKind ?? 'port';
    else if (AIRPORT_WORDS.has(word)) wantKind = 'airport';
    else if (!FILLER_WORDS.has(word)) terms.push(word);
  }
  if (terms.length === 0 || terms.join('').length < 2) return [];

  const termCache = new Map<string, string>();
  const countryText = (code: string) => {
    let text = termCache.get(code);
    if (text === undefined) {
      text = fold(countryTerms ? countryTerms(code) : '');
      termCache.set(code, text);
    }
    return text;
  };

  const scored: { d: Destination; score: number }[] = [];
  for (const d of list) {
    const name = fold(d.name);
    const code = d.code.toLowerCase();
    const country = countryText(d.countryCode);
    let score = 0;
    let ok = true;
    for (const term of terms) {
      if (code === term) score += 0;
      else if (name.startsWith(term)) score += 1;
      else if (new RegExp(`(^|[^a-z0-9])${term}`).test(name)) score += 2;
      else if (name.includes(term)) score += 3;
      else if (country.includes(term) || code.startsWith(term)) score += 4;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (wantKind && d.kind !== wantKind) score += 6;
    if (!wantKind && d.kind === 'airport') score += 0.5; // sea freight is the usual case: ports first on a tie
    if (countryCode && d.countryCode === countryCode) score -= 1.5;
    scored.push({ d, score });
  }
  scored.sort((a, b) => a.score - b.score || a.d.name.length - b.d.name.length || a.d.name.localeCompare(b.d.name));
  return scored.slice(0, limit).map((s) => s.d);
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Closest known port/airport to a map point, or null when none lies within `maxKm` (haversine). */
export function nearestDestination(list: Destination[], lat: number, lng: number, maxKm = 30): Destination | null {
  let best: Destination | null = null;
  let bestKm = maxKm;
  for (const d of list) {
    if (Math.abs(d.lat - lat) > 1 || Math.abs(d.lng - lng) > 2) continue;
    const dLat = toRad(d.lat - lat);
    const dLng = toRad(d.lng - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(d.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      best = d;
      bestKm = km;
    }
  }
  return best;
}

// OSM classes that are never a shipping destination (shops, restaurants, offices...): hidden from map search results.
const NOISE_CLASSES = new Set(['shop', 'amenity', 'tourism', 'leisure', 'office', 'craft', 'building', 'highway', 'historic', 'club']);
const PORT_TYPES = new Set(['harbour', 'port', 'aerodrome', 'ferry_terminal', 'terminal', 'dock', 'industrial', 'seaport']);

/** Orders map-search results: ports/airports first, then towns; drops shops and other points of interest unless nothing else matched. */
export function rankGeoResults<T extends { class?: string | null; type?: string | null }>(results: T[]): T[] {
  const rank = (r: T) => {
    const cls = (r.class || '').toLowerCase();
    const type = (r.type || '').toLowerCase();
    if (cls === 'aeroway' || PORT_TYPES.has(type)) return 0;
    if (cls === 'place' || cls === 'boundary') return 1;
    return NOISE_CLASSES.has(cls) ? 3 : 2;
  };
  const kept = results.filter((r) => rank(r) < 3);
  return (kept.length > 0 ? kept : results).slice().sort((a, b) => rank(a) - rank(b));
}
