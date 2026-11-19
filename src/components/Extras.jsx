import { img } from '../lib/tmdb.js';

export const REACTIONS = ['😂', '😱', '😍', '😢', '🔥', '👏', '🤯', '💀'];

/** Emojis that float up over the video (rendered inside the player, so they show in fullscreen too). */
export function Reactions({ items }) {
  return (
    <div className="reactions" aria-hidden="true">
      {items.map((r) => (
        <div key={r.id} className="float" style={{ left: `${r.x}%` }}>
          <span className="float-emoji">{r.emoji}</span>
          <span className="float-name">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ReactionBar({ onReact }) {
  return (
    <div className="reaction-bar">
      {REACTIONS.map((e) => (
        <button key={e} onClick={() => onReact(e)} title={`Send ${e} to everyone`}>
          {e}
        </button>
      ))}
    </div>
  );
}

/** Shown to everyone when the video ends (or when someone presses ⭐ Rate). */
export function RatingPrompt({ movie, ratings, myRating, memberCount, onRate, onClose }) {
  const values = Object.values(ratings);
  const up = values.filter((v) => v === 'up').length;
  const down = values.filter((v) => v === 'down').length;
  const verdict =
    !values.length ? null : up > down ? 'The room loved it 🎉' : down > up ? 'Not a hit with this room' : 'The room is split';

  return (
    <div className="overlay rate">
      <div className="rate-card">
        <button className="close" onClick={onClose} title="Close">×</button>
        {movie.poster_path && <img src={img(movie.poster_path, 'w154')} alt="" />}
        <div>
          <h3>Did you like {movie.title}?</h3>
          {!myRating ? (
            <div className="row">
              <button className="primary" onClick={() => onRate('up')}>👍 Loved it</button>
              <button onClick={() => onRate('down')}>👎 Not for me</button>
              <button onClick={() => onRate('skip')}>Skip</button>
            </div>
          ) : (
            <p className="muted">Thanks! Your rating will improve your suggestions.</p>
          )}
          <p className="tally">
            👍 {up} · 👎 {down} <span className="muted">({values.length} of {memberCount} rated)</span>
          </p>
          {verdict && <p><strong>{verdict}</strong></p>}
        </div>
      </div>
    </div>
  );
}
