import { discover } from './tmdb.js';

export const GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

/** Each mood pulls toward some genres (boost) and away from others (avoid). */
export const MOODS = {
  happy:    { label: 'Happy',              emoji: '😄', blurb: 'Keep the good vibes going',  boost: [35, 10751, 16, 10402, 12], avoid: [27, 10752] },
  down:     { label: 'Low, need comfort',  emoji: '🫂', blurb: 'Warm, feel-good stories',    boost: [35, 10749, 10751, 16],     avoid: [27, 53, 10752, 80] },
  cry:      { label: 'Want a good cry',    emoji: '😢', blurb: 'Emotional, moving drama',    boost: [18, 10749],                avoid: [27, 35] },
  pumped:   { label: 'Pumped',             emoji: '⚡', blurb: 'Adrenaline and action',      boost: [28, 12, 53, 878],          avoid: [10749, 99] },
  spooky:   { label: 'Want a scare',       emoji: '👻', blurb: 'Horror and suspense',        boost: [27, 53, 9648],             avoid: [10751, 16] },
  curious:  { label: 'Curious',            emoji: '🧠', blurb: 'Mind-benders, real stories', boost: [878, 9648, 99, 36],        avoid: [] },
  romantic: { label: 'Romantic',           emoji: '💘', blurb: 'Love stories',               boost: [10749],                    avoid: [27, 10752] },
  chill:    { label: 'Tired, chill',       emoji: '🛋️', blurb: 'Easy, light watching',       boost: [16, 35, 14, 10751],        avoid: [27, 10752, 53] },
  surprise: { label: 'Surprise me',        emoji: '🎲', blurb: 'Random but good',            boost: [],                         avoid: [] },
};

const RUNTIME = {
  any: {},
  short: { 'with_runtime.lte': 100 },
  medium: { 'with_runtime.gte': 90, 'with_runtime.lte': 130 },
  long: { 'with_runtime.gte': 130 },
};

const ERA = {
  any: {},
  classic: { 'primary_release_date.lte': '1999-12-31' },
  '2000s': { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2014-12-31' },
  recent: { 'primary_release_date.gte': '2015-01-01' },
};

/** Learns genre weights (-1..1) from movies the user liked / disliked. */
export function tasteWeights(profile) {
  const w = {};
  for (const m of Object.values(profile.liked)) for (const g of m.genre_ids || []) w[g] = (w[g] || 0) + 1;
  for (const m of Object.values(profile.disliked)) for (const g of m.genre_ids || []) w[g] = (w[g] || 0) - 1;
  const max = Math.max(1, ...Object.values(w).map(Math.abs));
  for (const g in w) w[g] /= max;
  return w;
}

export async function recommend({ moodKey, prefs, profile }) {
  const mood = MOODS[moodKey];
  const params = {
    sort_by: 'popularity.desc',
    include_adult: false,
    'vote_average.gte': prefs.minRating || undefined,
    // Smaller film industries have fewer TMDB votes, so relax the threshold there.
    'vote_count.gte': prefs.language === 'any' ? 200 : 15,
    with_genres: mood.boost.length ? mood.boost.join('|') : undefined, // "|" = OR
    without_genres: mood.avoid.length ? mood.avoid.join(',') : undefined,
    with_original_language: prefs.language === 'any' ? undefined : prefs.language,
    ...RUNTIME[prefs.runtime],
    ...ERA[prefs.era],
  };

  let pages;
  if (moodKey === 'surprise') {
    const first = await discover({ ...params, page: 1 });
    const total = Math.min(first.total_pages || 1, 25);
    const rand = () => 1 + Math.floor(Math.random() * total);
    const more = await Promise.all([rand(), rand()].map((page) => discover({ ...params, page })));
    pages = [first, ...more];
  } else {
    pages = await Promise.all([1, 2, 3].map((page) => discover({ ...params, page }).catch(() => ({ results: [] }))));
  }

  const exclude = new Set(
    [...Object.keys(profile.liked), ...Object.keys(profile.disliked), ...Object.keys(profile.seen)].map(Number)
  );
  const pool = new Map();
  for (const p of pages) for (const m of p.results || []) if (!exclude.has(m.id)) pool.set(m.id, m);

  const taste = tasteWeights(profile);
  const fav = new Set(profile.favGenres);
  const likedList = Object.values(profile.liked);

  return [...pool.values()]
    .map((m) => {
      const g = m.genre_ids || [];
      const moodHits = g.filter((x) => mood.boost.includes(x));
      const favHits = g.filter((x) => fav.has(x));
      const tasteScore = g.reduce((s, x) => s + (taste[x] || 0), 0);

      const score =
        moodHits.length * 2 +
        favHits.length * 2.5 +
        tasteScore * 3 +
        (m.vote_average / 10) * 4 +
        Math.log10(1 + m.popularity) * 0.5 +
        Math.random() * 0.8; // a little variety each run

      const reasons = [];
      if (moodHits.length) reasons.push(`Fits your mood: ${moodHits.map((x) => GENRES[x]).join(', ')}`);
      if (favHits.length) reasons.push(`Your genres: ${favHits.map((x) => GENRES[x]).join(', ')}`);
      const similar = likedList
        .map((l) => ({ l, overlap: (l.genre_ids || []).filter((x) => g.includes(x)).length }))
        .sort((a, b) => b.overlap - a.overlap)[0];
      if (similar && similar.overlap >= 2) reasons.push(`Because you liked ${similar.l.title}`);
      if (m.vote_average >= 7.5) reasons.push(`Highly rated (${m.vote_average.toFixed(1)}/10)`);

      return { ...m, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

/* ------------------------------------------------------------------ */
/* Group mood: one recommendation list that suits everyone in a room. */
/* ------------------------------------------------------------------ */

/** What each member shares with the room (kept small for realtime presence). */
export function shareableTaste(profile) {
  return {
    fav: profile.favGenres,
    taste: tasteWeights(profile),
    seen: [...Object.keys(profile.liked), ...Object.keys(profile.disliked), ...Object.keys(profile.seen)]
      .map(Number)
      .slice(0, 300),
  };
}

/**
 * members: [{ name, mood, fav, taste, seen }]
 * A movie scores well when it matches many people's moods, clashes with few,
 * and fits the group's combined taste.
 */
export async function recommendGroup({ members, language = 'any', minRating = 6 }) {
  const voters = members.filter((m) => MOODS[m.mood]);
  if (!voters.length) throw new Error('Nobody has picked a mood yet.');

  // Genres wanted by the most people go into the search.
  const want = {};
  for (const v of voters) for (const g of MOODS[v.mood].boost) want[g] = (want[g] || 0) + 1;
  const boosted = Object.entries(want).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => Number(g));

  // Only exclude a genre if at least half the group wants to avoid it and nobody wants it.
  const avoidCount = {};
  for (const v of voters) for (const g of MOODS[v.mood].avoid) avoidCount[g] = (avoidCount[g] || 0) + 1;
  const avoid = Object.entries(avoidCount)
    .filter(([g, c]) => c * 2 >= voters.length && !want[g])
    .map(([g]) => Number(g));

  const params = {
    sort_by: 'popularity.desc',
    include_adult: false,
    'vote_average.gte': minRating || undefined,
    'vote_count.gte': language === 'any' ? 200 : 15,
    with_genres: boosted.length ? boosted.join('|') : undefined,
    without_genres: avoid.length ? avoid.join(',') : undefined,
    with_original_language: language === 'any' ? undefined : language,
  };
  const pages = await Promise.all(
    [1, 2, 3, 4].map((page) => discover({ ...params, page }).catch(() => ({ results: [] })))
  );

  const exclude = new Set(members.flatMap((m) => m.seen || []));
  const pool = new Map();
  for (const p of pages) for (const m of p.results || []) if (!exclude.has(m.id)) pool.set(m.id, m);

  // Average everyone's learned taste and count shared favourite genres.
  const n = members.length || 1;
  const taste = {};
  const favCount = {};
  for (const m of members) {
    for (const [g, w] of Object.entries(m.taste || {})) taste[g] = (taste[g] || 0) + w / n;
    for (const g of m.fav || []) favCount[g] = (favCount[g] || 0) + 1;
  }

  return [...pool.values()]
    .map((m) => {
      const g = m.genre_ids || [];
      const happy = voters.filter((v) => !MOODS[v.mood].boost.length || g.some((x) => MOODS[v.mood].boost.includes(x)));
      const clash = voters.filter((v) => g.some((x) => MOODS[v.mood].avoid.includes(x)));
      const fit = (happy.length - clash.length * 1.5) / voters.length;
      const favFit = g.reduce((s, x) => s + (favCount[x] || 0), 0) / n;
      const tasteFit = g.reduce((s, x) => s + (taste[x] || 0), 0);

      const score =
        fit * 6 + favFit * 2 + tasteFit * 2 + (m.vote_average / 10) * 4 +
        Math.log10(1 + m.popularity) * 0.5 + Math.random() * 0.5;

      const reasons = [`Fits ${happy.length} of ${voters.length} moods`];
      if (voters.length > 1 && !clash.length) reasons.push("Doesn't clash with anyone's mood");
      const shared = g.filter((x) => (favCount[x] || 0) >= 2).map((x) => GENRES[x]);
      if (shared.length) reasons.push(`Shared favourite: ${shared.join(', ')}`);
      if (m.vote_average >= 7.5) reasons.push(`Highly rated (${m.vote_average.toFixed(1)}/10)`);

      return {
        id: m.id, title: m.title, poster_path: m.poster_path, release_date: m.release_date,
        vote_average: m.vote_average, overview: m.overview, genre_ids: g, reasons, score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}
