import { MOODS } from '../lib/recommender.js';
import { img } from '../lib/tmdb.js';
import { LANGS } from './Discover.jsx';

/**
 * Everyone picks a mood → anyone presses "Find a movie for all of us" →
 * the picks appear for the whole room → people vote → play the winner's trailer together.
 */
export default function GroupMood({
  members, myId, myMood, onPickMood, language, setLanguage,
  finding, onFind, picks, votes, onVote, onPlayTrailer,
}) {
  const present = new Set(members.map((m) => m.id));
  const tally = {};
  for (const [voter, movieId] of Object.entries(votes)) {
    if (present.has(voter)) tally[movieId] = (tally[movieId] || 0) + 1;
  }
  const myVote = votes[myId];
  const topCount = Math.max(0, ...Object.values(tally));
  const picked = members.filter((m) => MOODS[m.mood]).length;

  return (
    <section className="card group">
      <div className="row spread">
        <h2>🎭 Group mood</h2>
        <span className="muted">{picked} of {members.length} picked a mood</span>
      </div>

      <p className="muted">What are you in the mood for?</p>
      <div className="mood-mini">
        {Object.entries(MOODS).map(([key, m]) => (
          <button key={key} className={`chip ${myMood === key ? 'on' : ''}`} onClick={() => onPickMood(key)}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="room-moods">
        {members.map((m) => (
          <span key={m.id} className="chip">
            {MOODS[m.mood]?.emoji || '…'} {m.name}
            {m.id === myId && ' (you)'}
          </span>
        ))}
      </div>

      <div className="row">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ maxWidth: 180 }}>
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="primary" disabled={!picked || finding} onClick={onFind}>
          {finding ? 'Finding…' : '✨ Find a movie for all of us'}
        </button>
      </div>

      {picks.length > 0 && (
        <div className="picks">
          {picks.map((p) => {
            const count = tally[p.id] || 0;
            const leading = count > 0 && count === topCount;
            return (
              <div key={p.id} className={`pick ${leading ? 'leading' : ''}`}>
                {p.poster_path ? <img src={img(p.poster_path, 'w154')} alt="" /> : <div className="noposter small">🎬</div>}
                <div className="pick-body">
                  <strong>
                    {p.title} <span className="muted">{p.release_date?.slice(0, 4)} · ★ {p.vote_average?.toFixed(1)}</span>
                  </strong>
                  <ul className="reasons">
                    {p.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                  <div className="actions">
                    <button className={myVote === p.id ? 'voted' : ''} onClick={() => onVote(p.id)}>
                      🗳 {myVote === p.id ? 'Voted' : 'Vote'} {count > 0 && `(${count})`}
                    </button>
                    <button onClick={() => onPlayTrailer(p)}>▶ Trailer for everyone</button>
                    {leading && <span className="badge">Leading</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
