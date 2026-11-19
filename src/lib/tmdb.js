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

/** Streaming services that carry the movie in your region (data by JustWatch via TMDB). */
export async function getProviders(movieId) {
  const data = await get(`/movie/${movieId}/watch/providers`);
  const r = data.results?.[REGION];
  if (!r) return [];
  const all = [...(r.flatrate || []), ...(r.free || []), ...(r.ads || [])];
  return [...new Map(all.map((p) => [p.provider_id, p])).values()];
}
