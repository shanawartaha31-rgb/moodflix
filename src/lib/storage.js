import { useEffect, useState } from 'react';

const KEY = 'moodflix_profile_v1';
const EMPTY = { favGenres: [], liked: {}, disliked: {}, seen: {} };

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}

/** Taste profile kept in the browser. Swap for a database table if you add accounts. */
export function useProfile() {
  const [profile, setProfile] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }, [profile]);
  return [profile, setProfile];
}

export const slimMovie = (m) => ({ id: m.id, title: m.title, genre_ids: m.genre_ids, poster_path: m.poster_path });

/** Put a movie into exactly one bucket ('liked' | 'disliked' | 'seen'), or none (bucket = null). */
export function moveTo(profile, movie, bucket) {
  const next = { ...profile, liked: { ...profile.liked }, disliked: { ...profile.disliked }, seen: { ...profile.seen } };
  for (const b of ['liked', 'disliked', 'seen']) delete next[b][movie.id];
  if (bucket) next[bucket][movie.id] = slimMovie(movie);
  return next;
}
