import { useEffect, useState } from 'react';
import { GENRES, MOODS, recommend } from '../lib/recommender.js';
import { searchMovies, getTrailerKey, hasTmdbKey, img } from '../lib/tmdb.js';
import MovieCard from './MovieCard.jsx';

export const LANGS = [
  ['any', 'Any language'], ['en', 'English'], ['hi', 'Hindi'], ['ur', 'Urdu'], ['pa', 'Punjabi'],
  ['ko', 'Korean'], ['ja', 'Japanese'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'],
];

import { moveTo, slimMovie, GUEST_FREE_RUNS, guestRunsUsed, addGuestRun } from '../lib/storage.js';
import { authEnabled } from '../lib/auth.js';

export default function Discover({ user, requireLogin, profile, setProfile, onWatchTogether }) {
  const [mood, setMood] = useState(null);

  // The whole app glows in the colour of the chosen mood.
  useEffect(() => {
    const c = MOODS[mood]?.color;
    if (c) document.documentElement.style.setProperty('--mood', c);
  }, [mood]);
  const [prefs, setPrefs] = useState({ runtime: 'any', era: 'any', language: 'any', minRating: 6 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [guestUsed, setGuestUsed] = useState(guestRunsUsed);
  const isGuest = authEnabled && !user;
  const guestLeft = Math.max(0, GUEST_FREE_RUNS - guestUsed);

  if (!hasTmdbKey) {
    return (
      <div className="card warn">
        Add your free TMDB key as <code>VITE_TMDB_KEY</code> in a <code>.env</code> file (see README), then restart <code>npm run dev</code>.
      </div>
    );
  }

  async function run(m = mood) {
    if (!m) return;
    if (isGuest) {
      if (guestRunsUsed() >= GUEST_FREE_RUNS) {
        requireLogin(`You've used your ${GUEST_FREE_RUNS} free guest suggestions. Sign up free for unlimited suggestions — it takes 20 seconds.`);
        return;
      }
      addGuestRun();
      setGuestUsed(guestRunsUsed());
    }
    setMood(m);
    setLoading(true);
    setError('');
    try {
      const list = await recommend({ moodKey: m, prefs, profile });
      setResults(list);
      if (!list.length) setError('Nothing matched — try loosening the filters (language, era or rating).');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const data = await searchMovies(query.trim());
      setFound(data.results.slice(0, 6));
    } catch (e2) {
      setError(e2.message);
    }
  }

  const toggleFav = (id) =>
    setProfile((p) => ({
      ...p,
      favGenres: p.favGenres.includes(id) ? p.favGenres.filter((x) => x !== id) : [...p.favGenres, id],
    }));

  // A movie lives in at most one bucket: liked, disliked or seen.
  const mark = (movie, bucket) => {
    setProfile((p) => moveTo(p, movie, bucket));
    setResults((r) => r.filter((x) => x.id !== movie.id));
  };

  async function watchTogether(movie) {
    try {
      const key = await getTrailerKey(movie.id);
      if (!key) return setError(`No trailer found for ${movie.title}.`);
      onWatchTogether({ type: 'youtube', value: key, title: `${movie.title} — trailer`, movie: slimMovie(movie) });
    } catch (e) {
      setError(e.message);
    }
  }

  const liked = Object.values(profile.liked);

  return (
    <div className="discover">
      {isGuest && (
        <div className="guest-banner">
          <span>
            You're browsing as a guest — <strong>{guestLeft}</strong> free suggestion{guestLeft === 1 ? '' : 's'} left.
            Sign up to get unlimited picks and keep your history.
          </span>
          <button className="primary" onClick={() => requireLogin('signup')}>Sign up free</button>
        </div>
      )}

      <section className="hero">
        <div className="hero-text">
          <h2 className="hero-title">What are you in the mood for tonight?</h2>
          <p className="hero-sub">Tap how you feel. We'll match it with your taste and pick something worth watching.</p>
        </div>
        <div className="moods">
          {Object.entries(MOODS).map(([key, m]) => (
            <button
              key={key}
              className={`mood ${mood === key ? 'on' : ''}`}
              style={{ '--tile': m.color }}
              onClick={() => run(key)}
              aria-pressed={mood === key}
            >
              <span className="emoji" aria-hidden="true">{m.emoji}</span>
              <strong>{m.label}</strong>
              <span className="blurb">{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <details className="tune">
        <summary>
          <span>Fine-tune your picks</span>
          <span className="tune-meta">
            {profile.favGenres.length} genres · {liked.length} favourite movies
            {prefs.language !== 'any' && ` · ${LANGS.find(([v]) => v === prefs.language)?.[1]}`}
          </span>
        </summary>
        <div className="tune-body">
          <div className="tune-col">
            <h3>Genres you usually enjoy</h3>
            <div className="chips">
              {Object.entries(GENRES).map(([id, name]) => (
                <button
                  key={id}
                  className={`chip ${profile.favGenres.includes(Number(id)) ? 'on' : ''}`}
                  onClick={() => toggleFav(Number(id))}
                  aria-pressed={profile.favGenres.includes(Number(id))}
                >
                  {name}
                </button>
              ))}
            </div>

            <h3>Movies you love</h3>
            <p className="muted small-text">The more you add, the sharper the picks.</p>
            <form onSubmit={doSearch} className="search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Interstellar, 3 Idiots, Joyland…" />
              <button type="submit">Search</button>
            </form>
            {found.length > 0 && (
              <div className="found">
                {found.map((m) => (
                  <button
                    key={m.id}
                    className="found-item"
                    onClick={() => {
                      mark(m, 'liked');
                      setFound((f) => f.filter((x) => x.id !== m.id));
                    }}
                  >
                    {m.poster_path ? <img src={img(m.poster_path, 'w92')} alt="" /> : <span className="found-ph" />}
                    <span className="found-title">
                      {m.title} <span className="muted">{m.release_date?.slice(0, 4)}</span>
                    </span>
                    <span className="add">Add</span>
                  </button>
                ))}
              </div>
            )}
            {liked.length > 0 && (
              <div className="chips">
                {liked.map((m) => (
                  <span key={m.id} className="chip on">
                    {m.title}
                    <button className="x" onClick={() => mark(m, null)} aria-label={`Remove ${m.title}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="tune-col">
            <h3>Filters</h3>
            <div className="prefs">
              <label>
                Length
                <select value={prefs.runtime} onChange={(e) => setPrefs({ ...prefs, runtime: e.target.value })}>
                  <option value="any">Any length</option>
                  <option value="short">Short (under 1h40)</option>
                  <option value="medium">Normal (1h30–2h10)</option>
                  <option value="long">Long (2h10+)</option>
                </select>
              </label>
              <label>
                Era
                <select value={prefs.era} onChange={(e) => setPrefs({ ...prefs, era: e.target.value })}>
                  <option value="any">Any era</option>
                  <option value="classic">Classics (before 2000)</option>
                  <option value="2000s">2000–2014</option>
                  <option value="recent">2015 onwards</option>
                </select>
              </label>
              <label>
                Language
                <select value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}>
                  {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label>
                <span>Minimum rating <strong className="rating-val">★ {prefs.minRating}</strong></span>
                <input type="range" min="0" max="8.5" step="0.5" value={prefs.minRating}
                  onChange={(e) => setPrefs({ ...prefs, minRating: Number(e.target.value) })} />
              </label>
            </div>
          </div>
        </div>
      </details>

      {error && <div className="notice">{error}</div>}

      {loading && (
        <div className="grid" aria-busy="true" aria-label="Finding movies">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      )}

      {results.length > 0 && !loading && (
        <section className="results">
          <div className="results-head">
            <h2>
              <span aria-hidden="true">{MOODS[mood]?.emoji}</span> {MOODS[mood]?.blurb}
            </h2>
            <button onClick={() => run()}>Shuffle picks</button>
          </div>
          <div className="grid">
            {results.map((m) => (
              <MovieCard
                key={m.id}
                movie={m}
                onLike={(x) => mark(x, 'liked')}
                onDislike={(x) => mark(x, 'disliked')}
                onSeen={(x) => mark(x, 'seen')}
                onWatchTogether={watchTogether}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
