import { useState } from 'react';
import { img } from '../lib/tmdb.js';
import WhereToWatch from './WhereToWatch.jsx';

export default function MovieCard({ movie, region, onLike, onDislike, onSeen, onWatchTogether }) {
  const [open, setOpen] = useState(false);
  const year = movie.release_date?.slice(0, 4);
  const [mainReason, ...otherReasons] = movie.reasons || [];

  const toggle = () => setOpen((o) => !o);

  return (
    <article className={`movie ${open ? 'open' : ''}`}>
      <button className="poster" onClick={toggle} aria-expanded={open} aria-label={`${movie.title} — show details`}>
        {movie.poster_path ? (
          <img src={img(movie.poster_path, 'w342')} alt="" loading="lazy" />
        ) : (
          <span className="noposter">{movie.title}</span>
        )}
        <span className="rating">★ {movie.vote_average?.toFixed(1)}</span>
        <span className="poster-title">
          <strong>{movie.title}</strong>
          {year && <span>{year}</span>}
        </span>
      </button>

      <div className="movie-body">
        {mainReason && <p className="why">{mainReason}</p>}
        {otherReasons.length > 0 && (
          <div className="tags">
            {otherReasons.slice(0, 2).map((r) => <span key={r} className="tag">{r}</span>)}
          </div>
        )}

        {!open && <WhereToWatch movie={movie} region={region} compact />}

        {open && (
          <div className="details">
            <p>{movie.overview || 'No description available.'}</p>
            <WhereToWatch movie={movie} region={region} />
          </div>
        )}

        <div className="actions">
          <button className="primary together" onClick={() => onWatchTogether(movie)}>Watch trailer together</button>
          <div className="quick">
            <button className="icon" title="Seen it and loved it" aria-label="Loved it" onClick={() => onLike(movie)}>👍</button>
            <button className="icon" title="Not for me" aria-label="Not for me" onClick={() => onDislike(movie)}>👎</button>
            <button className="icon" title="Already seen" aria-label="Already seen" onClick={() => onSeen(movie)}>✓</button>
          </div>
        </div>
      </div>
    </article>
  );
}
