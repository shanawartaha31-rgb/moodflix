import { useState } from 'react';
import { img, getProviders } from '../lib/tmdb.js';

export default function MovieCard({ movie, onLike, onDislike, onSeen, onWatchTogether }) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState(null);
  const year = movie.release_date?.slice(0, 4);

  async function toggle() {
    setOpen((o) => !o);
    if (providers === null) setProviders(await getProviders(movie.id).catch(() => []));
  }

  return (
    <div className="movie">
      <div className="poster" onClick={toggle}>
        {movie.poster_path ? <img src={img(movie.poster_path)} alt={movie.title} loading="lazy" /> : <div className="noposter">{movie.title}</div>}
        <span className="rating">★ {movie.vote_average?.toFixed(1)}</span>
      </div>
      <div className="movie-body">
        <h3 onClick={toggle}>
          {movie.title} {year && <span className="muted">({year})</span>}
        </h3>
        <ul className="reasons">
          {movie.reasons?.slice(0, 2).map((r) => <li key={r}>{r}</li>)}
        </ul>
        {open && (
          <div className="details">
            <p>{movie.overview || 'No description available.'}</p>
            {providers?.length > 0 && (
              <p className="muted">Stream on: {providers.map((p) => p.provider_name).join(', ')}</p>
            )}
          </div>
        )}
        <div className="actions">
          <button title="Seen it and loved it" onClick={() => onLike(movie)}>👍</button>
          <button title="Not for me" onClick={() => onDislike(movie)}>👎</button>
          <button title="Already seen" onClick={() => onSeen(movie)}>✓ Seen</button>
          <button className="primary" title="Watch the trailer together" onClick={() => onWatchTogether(movie)}>
            ▶ Together
          </button>
        </div>
      </div>
    </div>
  );
}
