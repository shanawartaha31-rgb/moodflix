import { useEffect, useRef, useState } from 'react';
import { GENRES, MOODS, recommend } from '../lib/recommender.js';
import { searchMovies, getTrailerKey, hasTmdbKey, img, COUNTRIES, countryName, getRegion, saveRegion, getRegionProviders } from '../lib/tmdb.js';
import MovieCard from './MovieCard.jsx';
import MoodIcon from './MoodIcon.jsx';

const GENRE_COLORS = ['#FFC93C', '#FF6FB5', '#8B6CFF', '#33D1FF', '#5BE3A1', '#FF8A4C', '#C6F15A', '#FF5D7A'];
const genreColor = (id) => GENRE_COLORS[Object.keys(GENRES).indexOf(String(id)) % GENRE_COLORS.length];

/** A small confetti burst in the mood's colour from the tapped tile. */
function confetti(el, color) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.style.left = `${r.left + r.width / 2}px`;
  layer.style.top = `${r.top + r.height / 2}px`;
  const colors = [color, '#ffffff', '#FF6FB5', '#33D1FF', '#FFC93C'];
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement('span');
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 70;
    bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * dist - 30}px`);
    bit.style.setProperty('--rot', `${Math.random() * 540 - 270}deg`);
    bit.style.background = colors[i % colors.length];
    if (i % 3 === 0) bit.style.borderRadius = '50%';
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 900);
}

const SERVICES_KEY = 'moodflix_services';
function loadServices() {
  try {
    return JSON.parse(localStorage.getItem(SERVICES_KEY) || '[]');
  } catch {
    return [];
  }
}

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
  const [prefs, setPrefs] = useState(() => ({
    runtime: 'any',
    era: 'any',
    language: 'any',
    minRating: 6,
    region: getRegion(),
    services: loadServices(),
    onlyStreamable: false,
  }));
  const [regionProviders, setRegionProviders] = useState(null);

  // Remember country and services between visits.
  useEffect(() => {
    saveRegion(prefs.region);
    try {
      localStorage.setItem(SERVICES_KEY, JSON.stringify(prefs.services));
    } catch {
      /* ignore */
    }
  }, [prefs.region, prefs.services]);

  // Load the list of services for the chosen country.
  useEffect(() => {
    if (!hasTmdbKey) return;
    let alive = true;
    setRegionProviders(null);
    getRegionProviders(prefs.region)
      .then((list) => alive && setRegionProviders(list))
      .catch(() => alive && setRegionProviders([]));
    return () => {
      alive = false;
    };
  }, [prefs.region]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [guestUsed, setGuestUsed] = useState(guestRunsUsed);
  const isGuest = authEnabled && !user;
  const guestLeft = Math.max(0, GUEST_FREE_RUNS - guestUsed);
  const [updating, setUpdating] = useState(false);
  const runRef = useRef(null);
  const requestId = useRef(0); // ignore answers from older searches
  const tuneKey = JSON.stringify(prefs) + '|' + [...profile.favGenres].sort().join(',');
  const lastTuneKey = useRef(tuneKey);

  // Refresh the picks automatically when genres or filters change.
  // Waits a moment so dragging the rating slider doesn't fire a search per step.
  useEffect(() => {
    if (tuneKey === lastTuneKey.current) return;
    if (!mood) {
      lastTuneKey.current = tuneKey;
      return;
    }
    const t = setTimeout(() => runRef.current?.(mood, { auto: true }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuneKey]);

  if (!hasTmdbKey) {
    return (
      <div className="card warn">
        Add your free TMDB key as <code>VITE_TMDB_KEY</code> in a <code>.env</code> file (see README), then restart <code>npm run dev</code>.
      </div>
    );
  }

  async function run(m = mood, { auto = false } = {}) {
    if (!m) return;
    // Automatic refreshes after changing filters don't use up a guest's free suggestions.
    if (isGuest && !auto) {
      if (guestRunsUsed() >= GUEST_FREE_RUNS) {
        requireLogin(`You've used your ${GUEST_FREE_RUNS} free guest suggestions. Sign up free for unlimited suggestions — it takes 20 seconds.`);
        return;
      }
      addGuestRun();
      setGuestUsed(guestRunsUsed());
    }
    setMood(m);
    lastTuneKey.current = tuneKey;
    const id = ++requestId.current;
    if (auto && results.length) setUpdating(true);
    else setLoading(true);
    setError('');
    try {
      const list = await recommend({ moodKey: m, prefs, profile });
      if (id !== requestId.current) return;
      setResults(list);
      if (!list.length) setError(prefs.services.length || prefs.onlyStreamable ? 'Nothing matched on your services — select more services, or turn off the streaming filter.' : 'Nothing matched these filters — try another language, era or a lower rating.');
    } catch (e) {
      if (id === requestId.current) setError(e.message);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setUpdating(false);
      }
    }
  }  runRef.current = run;


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
              onClick={(e) => {
                if (mood !== key) confetti(e.currentTarget, m.color);
                run(key);
              }}
              aria-pressed={mood === key}
            >
              <span className="mood-art"><MoodIcon mood={key} /></span>
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
            {prefs.services.length > 0 && ` · ${prefs.services.length} service${prefs.services.length > 1 ? 's' : ''}`}
          </span>
        </summary>
        <p className="tune-note" role="status">
          {mood ? 'Your picks update automatically when you change anything here.' : 'Choose a mood above, and your picks will follow these settings.'}
        </p>
        <div className="tune-body">
          <div className="tune-col">
            <h3>Genres you usually enjoy</h3>
            <div className="chips">
              {Object.entries(GENRES).map(([id, name]) => (
                <button
                  key={id}
                  className={`chip genre ${profile.favGenres.includes(Number(id)) ? 'on' : ''}`}
                  style={{ '--chip': genreColor(id) }}
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

            <h3 className="wtw-heading">Where you watch</h3>
            <label className="field">
              Your country
              <select
                value={prefs.region}
                onChange={(e) => setPrefs({ ...prefs, region: e.target.value, services: [] })}
              >
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>

            <p className="field-label">My services <span className="muted">— only show movies on these</span></p>
            {regionProviders === null ? (
              <p className="muted small-text">Loading services…</p>
            ) : regionProviders.length === 0 ? (
              <p className="muted small-text">
                No streaming data for {countryName(prefs.region)}. Pick a nearby country to see services.
              </p>
            ) : (
              <div className="services">
                {regionProviders.map((p) => {
                  const on = prefs.services.includes(p.provider_id);
                  return (
                    <button
                      key={p.provider_id}
                      className={`service ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      title={p.provider_name}
                      onClick={() =>
                        setPrefs({
                          ...prefs,
                          services: on ? prefs.services.filter((x) => x !== p.provider_id) : [...prefs.services, p.provider_id],
                        })
                      }
                    >
                      {p.logo_path ? <img src={img(p.logo_path, 'w92')} alt="" /> : null}
                      <span>{p.provider_name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!prefs.services.length && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={prefs.onlyStreamable}
                  onChange={(e) => setPrefs({ ...prefs, onlyStreamable: e.target.checked })}
                />
                Only show movies I can stream in {countryName(prefs.region)}
              </label>
            )}
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
              <span className="results-icon" style={{ '--tile': MOODS[mood]?.color }}><MoodIcon mood={mood} size={34} /></span>
              {MOODS[mood]?.blurb}
            </h2>
            <div className="results-tools">
              {updating && <span className="updating" role="status">Updating picks…</span>}
              <button onClick={() => run()}>Shuffle picks</button>
            </div>
          </div>
          <div className={`grid ${updating ? 'is-updating' : ''}`} aria-busy={updating}>
            {results.map((m) => (
              <MovieCard
                key={m.id}
                movie={m}
                region={prefs.region}
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
