import { supabase } from './supabase.js';

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/** Loads a user's taste profile from the database (creates the profile row on first login). */
export async function loadAccount(user) {
  const [prof, rows] = await Promise.all([
    supabase.from('profiles').select('fav_genres').eq('id', user.id).maybeSingle().then(check),
    supabase.from('user_movies').select('*').eq('user_id', user.id).then(check),
  ]);

  if (!prof) {
    await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: user.user_metadata?.display_name || null })
      .then(check);
  }

  const profile = { favGenres: prof?.fav_genres || [], liked: {}, disliked: {}, seen: {} };
  for (const r of rows || []) {
    profile[r.status][r.movie_id] = { id: r.movie_id, title: r.title, genre_ids: r.genre_ids || [], poster_path: r.poster_path };
  }
  return profile;
}

const statusOf = (p, id) => (p.liked[id] ? 'liked' : p.disliked[id] ? 'disliked' : p.seen[id] ? 'seen' : null);
const findMovie = (p, id) => p.liked[id] || p.disliked[id] || p.seen[id];

/** Saves only what changed between two versions of a profile. */
export async function uploadDiff(userId, before, after) {
  const jobs = [];

  const a = [...before.favGenres].sort().join(',');
  const b = [...after.favGenres].sort().join(',');
  if (a !== b) {
    jobs.push(supabase.from('profiles').update({ fav_genres: after.favGenres }).eq('id', userId).then(check));
  }

  const ids = new Set();
  for (const p of [before, after]) for (const k of ['liked', 'disliked', 'seen']) Object.keys(p[k]).forEach((id) => ids.add(Number(id)));

  for (const id of ids) {
    const s1 = statusOf(before, id);
    const s2 = statusOf(after, id);
    if (s1 === s2) continue;
    if (!s2) {
      jobs.push(supabase.from('user_movies').delete().eq('user_id', userId).eq('movie_id', id).then(check));
    } else {
      const m = findMovie(after, id);
      jobs.push(
        supabase
          .from('user_movies')
          .upsert({
            user_id: userId,
            movie_id: id,
            status: s2,
            title: m.title,
            poster_path: m.poster_path,
            genre_ids: m.genre_ids || [],
            updated_at: new Date().toISOString(),
          })
          .then(check)
      );
    }
  }
  await Promise.all(jobs);
}

/** Records a viewing in a Watch Party. */
export async function logWatch(userId, { source, room, people }) {
  const m = source.movie;
  await supabase
    .from('watch_history')
    .insert({
      user_id: userId,
      movie_id: m?.id ?? null,
      title: m?.title ?? source.title,
      poster_path: m?.poster_path ?? null,
      genre_ids: m?.genre_ids ?? [],
      kind: /trailer$/i.test(source.title || '') ? 'trailer' : 'video',
      room_code: room,
      people,
    })
    .then(check);
}

export const loadWatchHistory = (userId) =>
  supabase
    .from('watch_history')
    .select('*')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false })
    .limit(200)
    .then(check);

export const deleteWatch = (id) => supabase.from('watch_history').delete().eq('id', id).then(check);
