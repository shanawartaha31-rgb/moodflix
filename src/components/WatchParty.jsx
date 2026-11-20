import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import SyncedPlayer from './SyncedPlayer.jsx';
import GroupMood from './GroupMood.jsx';
import MoodIcon from './MoodIcon.jsx';
import { MOODS, recommendGroup, shareableTaste } from '../lib/recommender.js';
import { getTrailerKey } from '../lib/tmdb.js';
import { moveTo, slimMovie } from '../lib/storage.js';
import { displayName, authEnabled } from '../lib/auth.js';
import { logWatch } from '../lib/db.js';
import { Reactions, ReactionBar, RatingPrompt } from './Extras.jsx';

const clientId = crypto.randomUUID();
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
// Network delay of a message, capped so a wrong device clock can't cause big jumps.
const lag = (at) => Math.min(Math.max((Date.now() - at) / 1000, 0), 2);
const sameSource = (a, b) => a && b && a.type === b.type && a.value === b.value;

function parseSource(input) {
  const s = input.trim();
  const yt = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/);
  if (yt) return { type: 'youtube', value: yt[1], title: 'YouTube video' };
  if (/^https?:\/\//i.test(s)) return { type: 'video', value: s, title: decodeURIComponent(s.split('/').pop().split('?')[0]) };
  return null;
}

export default function WatchParty({ user, requireLogin, profile, setProfile, initialRoom, pendingSource, onSourceUsed }) {
  const [name, setName] = useState(() => localStorage.getItem('moodflix_name') || '');
  const [codeInput, setCodeInput] = useState(initialRoom || '');
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [source, setSource] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [myMood, setMyMood] = useState(null);
  const [picks, setPicks] = useState([]);
  const [votes, setVotes] = useState({}); // clientId -> movieId
  const [finding, setFinding] = useState(false);
  const [groupLang, setGroupLang] = useState('any');
  const [reactions, setReactions] = useState([]); // floating emojis on screen
  const [ratingFor, setRatingFor] = useState(null); // movie being rated
  const [ratings, setRatings] = useState({}); // clientId -> 'up' | 'down'
  const [ratingOpen, setRatingOpen] = useState(false);

  const channelRef = useRef(null);
  const playerRef = useRef(null);
  const sourceRef = useRef(null);
  const pendingStateRef = useRef(null); // position to jump to once the player is ready
  const gotStateRef = useRef(false);
  const isLeaderRef = useRef(false);
  const myNameRef = useRef('Guest');
  const joinedAtRef = useRef(0);
  const myMoodRef = useRef(null);
  const picksRef = useRef([]);
  const votesRef = useRef({});
  const profileRef = useRef(profile);
  const userRef = useRef(user);
  userRef.current = user;
  const roomRef = useRef(null);
  const membersRef = useRef([]);
  const ratingForRef = useRef(null);
  const lastReactRef = useRef(0);
  const lastControlRef = useRef(0); // last play/pause/seek/load — drift correction waits after it
  const lastCorrectionRef = useRef(0);
  sourceRef.current = source;
  picksRef.current = picks;
  votesRef.current = votes;
  profileRef.current = profile;
  ratingForRef.current = ratingFor;
  roomRef.current = room;
  membersRef.current = members;

  // What I share with the room via presence: name, mood and a compact taste summary.
  const presence = () => ({
    name: myNameRef.current,
    joinedAt: joinedAtRef.current,
    mood: myMoodRef.current,
    ...shareableTaste(profileRef.current),
  });

  const send = (event, payload = {}) =>
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload: { ...payload, from: clientId, name: myNameRef.current, at: Date.now() },
    });

  function applyPending() {
    const p = playerRef.current;
    const s = pendingStateRef.current;
    if (!p?.ready() || !s) return;
    pendingStateRef.current = null;
    lastControlRef.current = Date.now();
    p.seek(s.time);
    if (s.playing) p.play();
    else p.pause();
  }

  function applyRemote(m) {
    const p = playerRef.current;
    if (!p?.ready()) return;
    if (m.action === 'play') {
      p.seek(m.time + lag(m.at));
      p.play();
    } else if (m.action === 'pause') {
      p.pause();
      p.seek(m.time);
    } else if (m.action === 'seek') {
      p.seek(m.time + (m.playing ? lag(m.at) : 0));
    } else if (m.action === 'tick') {
      // Leader's heartbeat. Ignore it right after someone pressed something,
      // never seek while our own video is still loading (that causes a jump-back loop
      // on slow connections), and correct at most once every 8 seconds.
      const now = Date.now();
      if (now - lastControlRef.current < 4000) return;
      if (!p.isPlaying()) p.play();
      if (!p.actuallyPlaying()) return;
      if (now - lastCorrectionRef.current < 8000) return;
      const target = m.time + lag(m.at);
      if (Math.abs(p.getTime() - target) > 2) {
        lastCorrectionRef.current = now;
        p.seek(target);
      }
      return;
    }
    lastControlRef.current = Date.now();
    if (m.action !== 'tick') addSystem(`${m.name} ${m.action === 'play' ? 'pressed play' : m.action === 'pause' ? 'paused' : 'skipped'}`);
  }

  const addSystem = (text) => setChat((c) => [...c.slice(-60), { system: true, text, at: Date.now() }]);

  function join(code) {
    if (!supabase) return;
    leave();
    const myName = (user ? displayName(user) : name.trim()) || 'Guest';
    myNameRef.current = myName;
    localStorage.setItem('moodflix_name', myName);
    gotStateRef.current = false;

    const ch = supabase.channel(`moodflix-${code}`, {
      config: { broadcast: { self: false }, presence: { key: clientId } },
    });

    ch.on('broadcast', { event: 'load' }, ({ payload }) => {
      pendingStateRef.current = { time: 0, playing: false };
      setSource(payload.source);
      addSystem(`${payload.name} loaded “${payload.source.title}”`);
    })
      .on('broadcast', { event: 'control' }, ({ payload }) => applyRemote(payload))
      .on('broadcast', { event: 'state-request' }, ({ payload }) => {
        // Someone just joined: tell them what's playing and where we are.
        const s = sourceRef.current;
        const p = playerRef.current;
        const hasVideo = s && p?.ready();
        if (!hasVideo && !picksRef.current.length) return;
        send('state', {
          to: payload.from,
          source: hasVideo ? s : null,
          time: hasVideo ? p.getTime() : 0,
          playing: hasVideo ? p.isPlaying() : false,
          picks: picksRef.current,
          votes: votesRef.current,
        });
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (payload.to !== clientId || gotStateRef.current) return;
        gotStateRef.current = true;
        if (payload.picks?.length) {
          setPicks(payload.picks);
          setVotes(payload.votes || {});
        }
        if (!payload.source) return;
        pendingStateRef.current = { time: payload.time + (payload.playing ? lag(payload.at) : 0), playing: payload.playing };
        if (sameSource(sourceRef.current, payload.source)) applyPending();
        else setSource(payload.source);
      })
      .on('broadcast', { event: 'group-picks' }, ({ payload }) => {
        setPicks(payload.picks);
        setVotes({});
        addSystem(`${payload.name} found movies for the group 🎭`);
      })
      .on('broadcast', { event: 'pick-vote' }, ({ payload }) =>
        setVotes((v) => ({ ...v, [payload.from]: payload.movieId }))
      )
      .on('broadcast', { event: 'react' }, ({ payload }) => addReaction(payload))
      .on('broadcast', { event: 'rate-prompt' }, ({ payload }) => {
        openRating(payload.movie);
        addSystem(`${payload.name} asked everyone to rate ${payload.movie.title}`);
      })
      .on('broadcast', { event: 'rating' }, ({ payload }) => {
        if (ratingForRef.current?.id !== payload.movieId) openRating(payload.movie, false);
        setRatings((r) => ({ ...r, [payload.from]: payload.value }));
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => setChat((c) => [...c.slice(-60), payload]))
      .on('presence', { event: 'sync' }, () => {
        const list = Object.entries(ch.presenceState())
          .map(([id, metas]) => ({ id, ...metas[0] }))
          .sort((a, b) => a.joinedAt - b.joinedAt);
        setMembers(list);
        isLeaderRef.current = list[0]?.id === clientId; // earliest joiner keeps everyone in sync
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          joinedAtRef.current = Date.now();
          await ch.track(presence());
          send('state-request');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Could not connect to the room. Check your Supabase settings and internet.');
        }
      });

    channelRef.current = ch;
    setRoom(code);
    setError('');
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState(null, '', url);
  }

  function leave() {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setRoom(null);
    setMembers([]);
    setSource(null);
    setChat([]);
    setPicks([]);
    setVotes({});
    setMyMood(null);
    myMoodRef.current = null;
    setRatingFor(null);
    setRatingOpen(false);
    setRatings({});
  }

  // ---- Emoji reactions ----
  function addReaction({ emoji, name: who }) {
    const id = Math.random().toString(36).slice(2);
    const r = { id, emoji, name: who, x: 8 + Math.random() * 84 };
    setReactions((list) => [...list.slice(-30), r]);
    setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 3000);
  }
  function react(emoji) {
    if (Date.now() - lastReactRef.current < 250) return; // light spam guard
    lastReactRef.current = Date.now();
    addReaction({ emoji, name: myNameRef.current });
    send('react', { emoji });
  }

  // ---- Rate after watching ----
  function openRating(movie, show = true) {
    if (!movie) return;
    if (ratingForRef.current?.id !== movie.id) setRatings({});
    ratingForRef.current = movie;
    setRatingFor(movie);
    if (show) setRatingOpen(true);
  }
  function askRoomToRate() {
    const movie = sourceRef.current?.movie;
    if (!movie) return;
    openRating(movie);
    send('rate-prompt', { movie });
  }
  function rate(value) {
    const movie = ratingForRef.current;
    if (!movie) return;
    if (value === 'skip') return setRatingOpen(false);
    setRatings((r) => ({ ...r, [clientId]: value }));
    send('rating', { movieId: movie.id, movie, value });
    // Your rating trains your own taste profile.
    setProfile((p) => moveTo(p, movie, value === 'up' ? 'liked' : 'disliked'));
  }

  function pickMood(key) {
    myMoodRef.current = key;
    setMyMood(key);
    channelRef.current?.track(presence());
    send('chat', { text: `is feeling ${MOODS[key].emoji} ${MOODS[key].label}` });
    setChat((c) => [...c.slice(-60), { system: true, text: `You're feeling ${MOODS[key].emoji} ${MOODS[key].label}` }]);
  }

  // Save "watched" to the user's history the first time a video actually plays.
  function noteWatched() {
    const u = userRef.current;
    const s = sourceRef.current;
    if (!u || !s) return;
    logWatch(u.id, { source: s, room: roomRef.current, people: membersRef.current.length || 1 }).catch((e) =>
      console.warn('Could not save watch history', e)
    );
  }

  async function findForGroup() {
    if (!requireLogin('Group mood is for members. Sign up free to find movies that suit your whole group.')) return;
    setFinding(true);
    setError('');
    try {
      const list = await recommendGroup({ members, language: groupLang });
      if (!list.length) throw new Error('No movie suits everyone with these settings — try "Any language".');
      setPicks(list);
      setVotes({});
      send('group-picks', { picks: list });
      addSystem('You found movies for the group 🎭');
    } catch (e) {
      setError(e.message);
    } finally {
      setFinding(false);
    }
  }

  function vote(movieId) {
    setVotes((v) => ({ ...v, [clientId]: movieId }));
    send('pick-vote', { movieId });
  }

  async function playPickTrailer(pick) {
    try {
      const key = await getTrailerKey(pick.id);
      if (!key) return setError(`No trailer found for ${pick.title}.`);
      loadSource({ type: 'youtube', value: key, title: `${pick.title} — trailer`, movie: slimMovie(pick) });
    } catch (e) {
      setError(e.message);
    }
  }

  function loadSource(src) {
    lastControlRef.current = Date.now();
    pendingStateRef.current = { time: 0, playing: false };
    setSource(src);
    send('load', { source: src });
  }

  // Leader heartbeat every 4s while playing.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (
        isLeaderRef.current &&
        p?.ready() &&
        p.isPlaying() &&
        p.actuallyPlaying() && // not buffering or blocked, so our time is trustworthy
        Date.now() - lastControlRef.current > 4000
      ) {
        send('control', { action: 'tick', time: p.getTime() });
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Re-share taste if it changes (e.g. liking movies in Discover while in a room).
  useEffect(() => {
    if (channelRef.current && joinedAtRef.current) channelRef.current.track(presence());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // A trailer sent from the Discover tab.
  useEffect(() => {
    if (pendingSource && room) {
      loadSource(pendingSource);
      onSourceUsed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSource, room]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supabase) {
    return (
      <div className="card warn">
        Watch Party needs a free Supabase project. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to
        your <code>.env</code> (see README) and restart.
      </div>
    );
  }

  if (!room) {
    const guest = authEnabled && !user;
    return (
      <div className="lobby">
        <div className="lobby-intro">
          <h2 className="hero-title">Watch together, from anywhere.</h2>
          <p className="hero-sub">
            Everyone in a room sees the same video. Play, pause and skip happen for all of you at once — phone, laptop, anywhere.
          </p>
          {pendingSource && <p className="ready">Ready to share: <strong>{pendingSource.title}</strong></p>}
          {user ? (
            <p className="muted">You'll appear as <strong>{displayName(user)}</strong></p>
          ) : (
            <label className="field">
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown to others in the room" />
            </label>
          )}
        </div>

        <div className="lobby-options">
          <div className="lobby-option host">
            <h3>Host a room</h3>
            <p className="muted">Get a code and invite link to send to your friends.</p>
            <button
              className="primary big"
              onClick={() =>
                requireLogin("Hosting rooms is for members. Sign up free to start a watch party — guests can still join a friend's room with a code.") &&
                join(makeCode())
              }
            >
              {guest ? '🔒 Create a room' : 'Create a room'}
            </button>
            {guest && <p className="muted small-text">Free account needed to host.</p>}
          </div>

          <form
            className="lobby-option"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeInput.trim().length === 6) join(codeInput.trim());
              else setError('Room codes have 6 letters or numbers.');
            }}
          >
            <h3>Join a friend</h3>
            <p className="muted">Type the 6-character code they sent you.</p>
            <input
              className="code-input"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="K3P9ZQ"
              maxLength={6}
              aria-label="Room code"
            />
            <button type="submit" className="big">Join room</button>
          </form>
        </div>
        {error && <p className="notice">{error}</p>}
      </div>
    );
  }

  const shareLink = `${window.location.origin}${window.location.pathname}?room=${room}`;

  return (
    <div className="party">
      <div className="party-main">
        <div className="row spread">
          <h2 className="room-title">
            <span className="muted">Room</span> <span className="code">{room}</span>
            <span className="live">{members.length} watching</span>
          </h2>
          <div className="row">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setError(`Share this link: ${shareLink}`);
                }
              }}
            >
              {copied ? 'Link copied' : 'Copy invite link'}
            </button>
            <button onClick={leave}>Leave</button>
          </div>
        </div>
        {error && <p className="warn-text">{error}</p>}

        {source ? (
          <>
            <p className="now">Now playing: <strong>{source.title}</strong></p>
            <SyncedPlayer
              ref={playerRef}
              source={source}
              onReady={applyPending}
              onLocalAction={(a) => {
                lastControlRef.current = Date.now();
                send('control', a);
              }}
              onEnded={() => source.movie && openRating(source.movie)}
              onStartedPlaying={noteWatched}
              overlay={
                <>
                  <Reactions items={reactions} />
                  {ratingOpen && ratingFor && (
                    <RatingPrompt
                      movie={ratingFor}
                      ratings={ratings}
                      myRating={ratings[clientId]}
                      memberCount={members.length}
                      onRate={rate}
                      onClose={() => setRatingOpen(false)}
                    />
                  )}
                </>
              }
              extraControls={
                source.movie && (
                  <button onClick={askRoomToRate} title="Ask everyone to rate this movie">⭐ Rate</button>
                )
              }
            />
            <ReactionBar onReact={react} />
          </>
        ) : (
          <div className="empty">Nothing playing yet. Paste a link below, use Group mood to pick something together, or press “▶ Together” on a movie in Discover.</div>
        )}

        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const src = parseSource(urlInput);
            if (!src) return setError('Paste a YouTube link or a direct video URL (.mp4 / .webm).');
            setError('');
            setUrlInput('');
            loadSource(src);
          }}
        >
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="YouTube link or direct .mp4 URL" />
          <button type="submit">Load for everyone</button>
        </form>

        <GroupMood
          members={members}
          myId={clientId}
          myMood={myMood}
          onPickMood={pickMood}
          language={groupLang}
          setLanguage={setGroupLang}
          finding={finding}
          onFind={findForGroup}
          picks={picks}
          votes={votes}
          onVote={vote}
          onPlayTrailer={playPickTrailer}
        />
      </div>

      <aside className="sidebar card">
        <h3>Watching ({members.length})</h3>
        <ul className="members">
          {members.map((m, i) => (
            <li key={m.id} style={{ '--tile': MOODS[m.mood]?.color }}>
              {MOODS[m.mood] && <MoodIcon mood={m.mood} size={18} />} {m.name} {m.id === clientId && <span className="muted">(you)</span>} {i === 0 && <span title="Keeps everyone in sync">⭐</span>}
            </li>
          ))}
        </ul>
        <h3>Chat</h3>
        <div className="chat">
          {chat.map((c, i) =>
            c.system ? (
              <div key={i} className="sys">{c.text}</div>
            ) : (
              <div key={i}><strong>{c.name}:</strong> {c.text}</div>
            )
          )}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const text = msg.trim();
            if (!text) return;
            const entry = { name: myNameRef.current, text, at: Date.now() };
            setChat((c) => [...c.slice(-60), entry]);
            send('chat', { text });
            setMsg('');
          }}
        >
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Say something…" />
          <button type="submit">Send</button>
        </form>
      </aside>
    </div>
  );
}
