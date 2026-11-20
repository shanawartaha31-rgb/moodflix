import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAccount, uploadDiff } from './db.js';

const GUEST_KEY = 'moodflix_profile_v1';
const EMPTY = { favGenres: [], liked: {}, disliked: {}, seen: {} };

function loadGuest() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(GUEST_KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}
function saveGuest(p) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
function clearGuest() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

export const slimMovie = (m) => ({ id: m.id, title: m.title, genre_ids: m.genre_ids, poster_path: m.poster_path });

/** Put a movie into exactly one bucket ('liked' | 'disliked' | 'seen'), or none (bucket = null). */
export function moveTo(profile, movie, bucket) {
  const next = { ...profile, liked: { ...profile.liked }, disliked: { ...profile.disliked }, seen: { ...profile.seen } };
  for (const b of ['liked', 'disliked', 'seen']) delete next[b][movie.id];
  if (bucket) next[bucket][movie.id] = slimMovie(movie);
  return next;
}

/** Guest activity is added on top of the account (guest choices are newer, so they win). */
function mergeProfiles(account, guest) {
  let merged = { ...account, favGenres: [...new Set([...account.favGenres, ...guest.favGenres])] };
  for (const b of ['liked', 'disliked', 'seen']) for (const m of Object.values(guest[b])) merged = moveTo(merged, m, b);
  return merged;
}

/**
 * Taste profile.
 * - Guest: saved in this browser only.
 * - Logged in: loaded from and saved to Supabase, so it follows the user to every device.
 *   On login, anything the guest did is moved into the account.
 */
export function useProfile(user) {
  const uid = user?.id ?? null;
  const [state, setState] = useState(() => ({ owner: null, p: loadGuest() }));
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const prev = useRef(state);

  // Switch between guest data and account data.
  useEffect(() => {
    if (!uid) {
      setState({ owner: null, p: loadGuest() });
      return;
    }
    let cancelled = false;
    setSyncing(true);
    setSyncError('');
    (async () => {
      try {
        const account = await loadAccount(user);
        const merged = mergeProfiles(account, loadGuest());
        await uploadDiff(uid, account, merged);
        clearGuest();
        if (!cancelled) setState({ owner: uid, p: merged });
      } catch (e) {
        console.error('Could not load account data', e);
        if (!cancelled) setSyncError('Could not load your saved data. Did you run supabase/schema.sql?');
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Save every change.
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (state.owner === null) return saveGuest(state.p);
    if (before.owner !== state.owner) return; // just loaded, nothing to upload
    uploadDiff(state.owner, before.p, state.p).catch((e) => {
      console.error('Sync failed', e);
      setSyncError('Some changes could not be saved. Check your internet connection.');
    });
  }, [state]);

  const setProfile = useCallback(
    (fn) => setState((s) => ({ ...s, p: typeof fn === 'function' ? fn(s.p) : fn })),
    []
  );

  return [state.p, setProfile, { syncing, syncError }];
}

// ---- Guest limits ----
export const GUEST_FREE_RUNS = 3;
const RUNS_KEY = 'moodflix_guest_runs';
export function guestRunsUsed() {
  try {
    return Number(localStorage.getItem(RUNS_KEY) || 0);
  } catch {
    return 0;
  }
}
export function addGuestRun() {
  try {
    localStorage.setItem(RUNS_KEY, String(guestRunsUsed() + 1));
  } catch {
    /* ignore */
  }
}
