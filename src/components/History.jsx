import { useEffect, useState } from 'react';
import { loadWatchHistory, deleteWatch } from '../lib/db.js';
import { moveTo } from '../lib/storage.js';
import { img } from '../lib/tmdb.js';
import { GENRES } from '../lib/recommender.js';
import { authEnabled } from '../lib/auth.js';

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function History({ user, requireLogin, profile, setProfile }) {
  const [watched, setWatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [list, setList] = useState('liked');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    loadWatchHistory(user.id)
      .then(setWatched)
      .catch((e) => setError(`Could not load history: ${e.message}. Did you run supabase/schema.sql?`))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authEnabled) {
    return <div className="card warn">History needs Supabase. Add your Supabase keys to <code>.env</code> (see README).</div>;
  }

  if (!user) {
    return (
      <div className="card lobby center">
        <h2>📜 Your history lives in your account</h2>
        <p className="muted">
          Sign up free and MoodFlix remembers everything you watch in watch parties and every movie you like or skip — on your
          phone, laptop, anywhere.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={() => requireLogin('signup')}>Sign up free</button>
          <button onClick={() => requireLogin('login')}>Log in</button>
        </div>
      </div>
    );
  }

  const buckets = {
    liked: { label: '👍 Liked', items: Object.values(profile.liked) },
    disliked: { label: '👎 Not for me', items: Object.values(profile.disliked) },
    seen: { label: '✓ Seen', items: Object.values(profile.seen) },
  };

  // Top genres across liked movies + watched movies.
  const genreCount = {};
  for (const m of [...buckets.liked.items, ...watched]) for (const g of m.genre_ids || []) genreCount[g] = (genreCount[g] || 0) + 1;
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => GENRES[g])
    .filter(Boolean);

  async function remove(id) {
    try {
      await deleteWatch(id);
      setWatched((w) => w.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="history">
      <div className="stats">
        <div className="stat"><strong>{watched.length}</strong><span>Watched together</span></div>
        <div className="stat"><strong>{buckets.liked.items.length}</strong><span>Liked</span></div>
        <div className="stat"><strong>{buckets.disliked.items.length}</strong><span>Not for me</span></div>
        <div className="stat"><strong>{buckets.seen.items.length}</strong><span>Seen</span></div>
        {topGenres.length > 0 && (
          <div className="stat wide"><strong>{topGenres.join(' · ')}</strong><span>Your top genres</span></div>
        )}
      </div>

      {error && <div className="card warn">{error}</div>}

      <section className="card">
        <h2>🍿 Watched in watch parties</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !watched.length ? (
          <p className="muted">Nothing yet. Everything you play in a Watch Party will show up here.</p>
        ) : (
          <ul className="watch-list">
            {watched.map((w) => (
              <li key={w.id}>
                {w.poster_path ? <img src={img(w.poster_path, 'w92')} alt="" /> : <div className="noposter tiny">🎬</div>}
                <div className="watch-info">
                  <strong>{w.title}</strong> {w.kind === 'trailer' && <span className="badge soft">Trailer</span>}
                  <span className="muted">
                    {when(w.watched_at)}
                    {w.room_code && ` · room ${w.room_code}`}
                    {w.people > 1 && ` · with ${w.people - 1} other${w.people > 2 ? 's' : ''}`}
                  </span>
                </div>
                <button className="x" title="Remove from history" onClick={() => remove(w.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row">
          {Object.entries(buckets).map(([k, b]) => (
            <button key={k} className={`chip ${list === k ? 'on' : ''}`} onClick={() => setList(k)}>
              {b.label} ({b.items.length})
            </button>
          ))}
        </div>
        {!buckets[list].items.length ? (
          <p className="muted">Nothing here yet — use 👍 / 👎 / ✓ Seen in Discover, or rate movies after a watch party.</p>
        ) : (
          <div className="mini-grid">
            {buckets[list].items.map((m) => (
              <div key={m.id} className="mini">
                {m.poster_path ? <img src={img(m.poster_path, 'w154')} alt="" /> : <div className="noposter">{m.title}</div>}
                <span>{m.title}</span>
                <button className="x" title="Remove" onClick={() => setProfile((p) => moveTo(p, m, null))}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
