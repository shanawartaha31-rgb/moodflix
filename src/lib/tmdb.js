const KEY = import.meta.env.VITE_TMDB_KEY;
const BASE = 'https://api.themoviedb.org/3';
export const REGION = import.meta.env.VITE_REGION || 'PK';
export const hasTmdbKey = Boolean(KEY);

export const img = (path, size = 'w342') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json();
}

export const discover = (params) => get('/discover/movie', params);
export const searchMovies = (query) => get('/search/movie', { query, include_adult: false });

export async function getTrailerKey(movieId) {
  const data = await get(`/movie/${movieId}/videos`);
  const yt = data.results.filter((v) => v.site === 'YouTube');
  const pick = yt.find((v) => v.type === 'Trailer' && v.official) || yt.find((v) => v.type === 'Trailer') || yt[0];
  return pick?.key || null;
}

// ---------------- Where to watch (data by JustWatch, via TMDB) ----------------

export const COUNTRIES = [
  ['PK', 'Pakistan'], ['IN', 'India'], ['AE', 'UAE'], ['SA', 'Saudi Arabia'], ['GB', 'United Kingdom'],
  ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'], ['TR', 'Turkey'], ['MY', 'Malaysia'],
];
export const countryName = (code) => COUNTRIES.find(([c]) => c === code)?.[1] || code;

const REGION_KEY = 'moodflix_region';
export function getRegion() {
  try {
    return localStorage.getItem(REGION_KEY) || REGION;
  } catch {
    return REGION;
  }
}
export function saveRegion(code) {
  try {
    localStorage.setItem(REGION_KEY, code);
  } catch {
    /* ignore */
  }
}

const providerCache = new Map(); // movieId -> promise of all regions' data

/**
 * Where a movie can be watched in `region`:
 * { link, stream, free, rent, buy, elsewhere: [{ region, provider }] }
 * Each list holds TMDB provider objects ({ provider_id, provider_name, logo_path }).
 */
export async function getWatchInfo(movieId, region) {
  if (!providerCache.has(movieId)) {
    providerCache.set(movieId, get(`/movie/${movieId}/watch/providers`).catch((e) => {
      providerCache.delete(movieId);
      throw e;
    }));
  }
  const all = (await providerCache.get(movieId)).results || {};
  const r = all[region] || {};
  const uniq = (list) => [...new Map((list || []).map((p) => [p.provider_id, p])).values()];

  // If it's not streaming here, find a well-known place it streams in another listed country.
  const elsewhere = [];
  if (!r.flatrate?.length && !r.free?.length && !r.ads?.length) {
    for (const [code] of COUNTRIES) {
      if (code === region) continue;
      const p = all[code]?.flatrate?.[0] || all[code]?.free?.[0];
      if (p) elsewhere.push({ region: code, provider: p });
      if (elsewhere.length >= 2) break;
    }
  }

  return {
    link: r.link || `https://www.themoviedb.org/movie/${movieId}/watch?locale=${region}`,
    stream: uniq(r.flatrate),
    free: uniq([...(r.free || []), ...(r.ads || [])]),
    rent: uniq(r.rent),
    buy: uniq(r.buy),
    elsewhere,
  };
}

/** The streaming services available in a country (most popular first), for the "My services" filter. */
export async function getRegionProviders(region) {
  const data = await get('/watch/providers/movie', { watch_region: region });
  return (data.results || [])
    .sort((a, b) => (a.display_priorities?.[region] ?? a.display_priority ?? 99) - (b.display_priorities?.[region] ?? b.display_priority ?? 99))
    .slice(0, 18);
}

/** Opens a search for the movie on the service's own site (falls back to the TMDB watch page). */
const SEARCH_URLS = [
  [/netflix/i, 'https://www.netflix.com/search?q='],
  [/amazon|prime video/i, 'https://www.primevideo.com/search?phrase='],
  [/hotstar/i, 'https://www.hotstar.com/in/explore?search_query='],
  [/disney/i, 'https://www.disneyplus.com/search?q='],
  [/apple tv/i, 'https://tv.apple.com/search?term='],
  [/youtube/i, 'https://www.youtube.com/results?search_query='],
  [/google play/i, 'https://play.google.com/store/search?c=movies&q='],
  [/mubi/i, 'https://mubi.com/en/search/films?query='],
  [/zee5/i, 'https://www.zee5.com/search?q='],
  [/hbo|^max/i, 'https://play.max.com/search?q='],
  [/crunchyroll/i, 'https://www.crunchyroll.com/search?q='],
];
export function watchUrl(provider, title, fallback) {
  const hit = SEARCH_URLS.find(([re]) => re.test(provider.provider_name));
  return hit ? hit[1] + encodeURIComponent(title) : fallback;
}
