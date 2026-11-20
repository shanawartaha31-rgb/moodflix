import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/* Loads the YouTube IFrame API once. */
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

const fmt = (t) => {
  const s = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * One player for YouTube videos and direct video files (mp4/webm).
 * Native controls are hidden: every play/pause/seek goes through our own buttons,
 * so local actions can be broadcast and remote ones applied without feedback loops.
 */
const SyncedPlayer = forwardRef(function SyncedPlayer({ source, onReady, onLocalAction, onEnded, onStartedPlaying, overlay, extraControls }, ref) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytRef = useRef(null);
  const readyRef = useRef(false);
  const intentRef = useRef(false); // what the room wants: playing or paused
  const stuckSince = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onStartedRef = useRef(onStartedPlaying);
  onStartedRef.current = onStartedPlaying;
  const startedRef = useRef(false); // fired onStartedPlaying for this video yet?
  const ended = () => {
    intentRef.current = false;
    onEndedRef.current?.();
  };

  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scrub, setScrub] = useState(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const isYT = source.type === 'youtube';

  // Low-level operations on whichever player is active.
  const raw = {
    play: () => (isYT ? ytRef.current?.playVideo() : videoRef.current?.play().catch(() => setBlocked(true))),
    pause: () => (isYT ? ytRef.current?.pauseVideo() : videoRef.current?.pause()),
    seek: (t) => (isYT ? ytRef.current?.seekTo(Math.max(0, t), true) : videoRef.current && (videoRef.current.currentTime = Math.max(0, t))),
    getTime: () => (isYT ? ytRef.current?.getCurrentTime?.() : videoRef.current?.currentTime) || 0,
    getDuration: () => (isYT ? ytRef.current?.getDuration?.() : videoRef.current?.duration) || 0,
    actuallyPlaying: () => {
      if (isYT) return [1, 3].includes(ytRef.current?.getPlayerState?.()); // playing or buffering
      const v = videoRef.current;
      return !!v && !v.paused && !v.ended;
    },
    setMuted: (m) => {
      if (isYT) m ? ytRef.current?.mute() : ytRef.current?.unMute();
      else if (videoRef.current) videoRef.current.muted = m;
    },
  };
  const rawRef = useRef(raw);
  rawRef.current = raw;

  const markReady = () => {
    readyRef.current = true;
    setReady(true);
    onReadyRef.current?.();
  };

  // Public API used by WatchParty to apply remote actions.
  useImperativeHandle(ref, () => ({
    ready: () => readyRef.current,
    play: () => { intentRef.current = true; rawRef.current.play(); },
    pause: () => { intentRef.current = false; rawRef.current.pause(); },
    seek: (t) => rawRef.current.seek(t),
    getTime: () => rawRef.current.getTime(),
    isPlaying: () => intentRef.current,
    actuallyPlaying: () => readyRef.current && rawRef.current.actuallyPlaying(),
  }), []);

  // Reset when the source changes.
  useEffect(() => {
    readyRef.current = false;
    intentRef.current = false;
    startedRef.current = false;
    setReady(false);
    setBlocked(false);
    setTime(0);
    setDur(0);
  }, [source.type, source.value]);

  // Create the YouTube player.
  useEffect(() => {
    if (!isYT) return;
    let cancelled = false;
    let player;
    loadYT().then((YT) => {
      if (cancelled || !ytHostRef.current) return;
      const el = document.createElement('div');
      ytHostRef.current.innerHTML = '';
      ytHostRef.current.appendChild(el);
      player = new YT.Player(el, {
        videoId: source.value,
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3 },
        events: {
          onReady: () => {
            ytRef.current = player;
            markReady();
          },
          onStateChange: (e) => {
            if (e.data === 0) ended(); // 0 = ended
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { /* already gone */ }
      ytRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT, source.value]);

  // Poll for UI and detect browsers blocking autoplay.
  useEffect(() => {
    const id = setInterval(() => {
      if (!readyRef.current) return;
      const r = rawRef.current;
      setTime(r.getTime());
      setDur(r.getDuration());
      const actual = r.actuallyPlaying();
      setPlaying(actual);
      if (actual && !startedRef.current) {
        startedRef.current = true;
        onStartedRef.current?.();
      }
      if (intentRef.current && !actual) {
        if (!stuckSince.current) stuckSince.current = Date.now();
        else if (Date.now() - stuckSince.current > 2500) setBlocked(true);
      } else {
        stuckSince.current = 0;
        if (actual) setBlocked(false);
      }
    }, 400);
    return () => clearInterval(id);
  }, []);

  // ---- Local user actions: apply here, then tell the room. ----
  const localPlay = () => {
    intentRef.current = true;
    setBlocked(false);
    raw.play();
    onLocalAction?.({ action: 'play', time: raw.getTime() });
  };
  const localPause = () => {
    intentRef.current = false;
    raw.pause();
    onLocalAction?.({ action: 'pause', time: raw.getTime() });
  };
  const localSeek = (t) => {
    raw.seek(t);
    setTime(t);
    onLocalAction?.({ action: 'seek', time: t, playing: intentRef.current });
  };
  const commitScrub = () => {
    if (scrub !== null) localSeek(scrub);
    setScrub(null);
  };
  const toggleMute = () => {
    raw.setMuted(!muted);
    setMuted(!muted);
  };
  const fullscreen = () => {
    const el = wrapRef.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen?.();
  };

  return (
    <div className="player" ref={wrapRef}>
      <div className="screen">
        {isYT ? (
          <>
            <div ref={ytHostRef} className="yt-host" />
            {/* Blocks clicks on the iframe so nobody can pause it without syncing. */}
            <div className="yt-shield" onClick={() => (intentRef.current ? localPause() : localPlay())} />
          </>
        ) : (
          <video
            key={source.value}
            ref={videoRef}
            src={source.value}
            playsInline
            preload="auto"
            onLoadedMetadata={markReady}
            onEnded={ended}
            onClick={() => (intentRef.current ? localPause() : localPlay())}
          />
        )}
        {overlay}
        {!ready && <div className="overlay">Loading video…</div>}
        {blocked && (
          <button className="overlay tap" onClick={localPlay}>
            ▶ Tap to join playback
            <small>Your browser blocked autoplay</small>
          </button>
        )}
      </div>

      <div className="controls">
        <button onClick={() => (intentRef.current ? localPause() : localPlay())} disabled={!ready}>
          {playing || intentRef.current ? '⏸' : '▶'}
        </button>
        <button onClick={() => localSeek(Math.max(0, time - 10))} disabled={!ready}>⟲10</button>
        <button onClick={() => localSeek(time + 10)} disabled={!ready}>10⟳</button>
        <span className="time">{fmt(scrub ?? time)} / {fmt(dur)}</span>
        <input
          className="seek"
          type="range"
          min="0"
          max={dur || 0}
          step="0.5"
          value={scrub ?? time}
          disabled={!ready}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
        />
        {extraControls}
        <button onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
        <button onClick={fullscreen}>⛶</button>
      </div>
    </div>
  );
});

export default SyncedPlayer;
