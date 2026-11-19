import { useState } from 'react';
import { GENRES, MOODS, recommend } from '../lib/recommender.js';
import { searchMovies, getTrailerKey, hasTmdbKey, img } from '../lib/tmdb.js';
import MovieCard from './MovieCard.jsx';

export const LANGS = [
  ['any', 'Any language'], ['en', 'English'], ['hi', 'Hindi'], ['ur', 'Urdu'], ['pa', 'Punjabi'],
  ['ko', 'Korean'], ['ja', 'Japanese'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'],
];

import { moveTo, slimMovie } from '../lib/storage.js';

export default function Discover({ profile, setProfile, onWatchTogether }) {
  const [mood, setMood] = useState(null);
  const [prefs, setPrefs] = useState({ runtime: 'any', era: 'any', language: 'any', minRating: 6 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);

  if (!hasTmdbKey) {
    return (
      <div className="card warn">
        Add your free TMDB key as <code>VITE_TMDB_KEY</code> in a <code>.env</code> file (see README), then restart <code>npm run dev</code>.
      </div>
    );
  }

  async function run(m = mood) {
    if (!m) return;
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
      <section className="card">
        <h2>1 · Your taste</h2>
        <p className="muted">Pick genres you usually enjoy:</p>
        <div className="chips">
          {Object.entries(GENRES).map(([id, name]) => (
            <button
              key={id}
              className={`chip ${profile.favGenres.includes(Number(id)) ? 'on' : ''}`}
              onClick={() => toggleFav(Number(id))}
            >
              {name}
            </button>
          ))}
        </div>

        <p className="muted">Add a few movies you love — the more you add, the better it gets:</p>
        <form onSubmit={doSearch} className="row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Interstellar, 3 Idiots, Joyland" />
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
                {m.poster_path && <img src={img(m.poster_path, 'w92')} alt="" />}
                <span>
                  {m.title} <span className="muted">{m.release_date?.slice(0, 4)}</span>
                </span>
                <span className="add">＋ Love it</span>
              </button>
            ))}
          </div>
        )}
        {liked.length > 0 && (
          <div className="chips">
            {liked.map((m) => (
              <span key={m.id} className="chip on">
                ❤ {m.title}{' '}
                <button className="x" onClick={() => mark(m, null)} title="Remove">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>2 · Preferences</h2>
        <div className="prefs">
          <label>
            Length
            <select value={prefs.runtime} onChange={(e) => setPrefs({ ...prefs, runtime: e.target.value })}>
              <option value="any">Any</option>
              <option value="short">Short (under 1h40)</option>
              <option value="medium">Normal (1h30–2h10)</option>
              <option value="long">Long (2h10+)</option>
            </select>
          </label>
          <label>
            Era
            <select value={prefs.era} onChange={(e) => setPrefs({ ...prefs, era: e.target.value })}>
              <option value="any">Any</option>
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
            Min rating: {prefs.minRating}
            <input type="range" min="0" max="8.5" step="0.5" value={prefs.minRating}
              onChange={(e) => setPrefs({ ...prefs, minRating: Number(e.target.value) })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>3 · How are you feeling right now?</h2>
        <div className="moods">
          {Object.entries(MOODS).map(([key, m]) => (
            <button key={key} className={`mood ${mood === key ? 'on' : ''}`} onClick={() => run(key)}>
              <span className="emoji">{m.emoji}</span>
              <strong>{m.label}</strong>
              <span className="muted">{m.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <div className="card warn">{error}</div>}
      {loading && <p className="muted center">Finding movies for you…</p>}

      {results.length > 0 && !loading && (
        <section>
          <div className="row spread">
            <h2>Picked for you {MOODS[mood]?.emoji}</h2>
            <button onClick={() => run()}>↻ More like this</button>
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
