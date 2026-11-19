import { useState } from 'react';
import Discover from './components/Discover.jsx';
import WatchParty from './components/WatchParty.jsx';
import { useProfile } from './lib/storage.js';

export default function App() {
  const [profile, setProfile] = useProfile();
  const initialRoom = new URLSearchParams(window.location.search).get('room');
  const [tab, setTab] = useState(initialRoom ? 'party' : 'discover');
  const [pendingSource, setPendingSource] = useState(null);

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎬 MoodFlix</h1>
        <nav>
          <button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}>
            Discover
          </button>
          <button className={tab === 'party' ? 'active' : ''} onClick={() => setTab('party')}>
            Watch Party
          </button>
        </nav>
      </header>

      {/* Both stay mounted so switching tabs doesn't drop you out of a watch party. */}
      <main style={{ display: tab === 'discover' ? 'block' : 'none' }}>
        <Discover
          profile={profile}
          setProfile={setProfile}
          onWatchTogether={(src) => {
            setPendingSource(src);
            setTab('party');
          }}
        />
      </main>
      <main style={{ display: tab === 'party' ? 'block' : 'none' }}>
        <WatchParty
          profile={profile}
          setProfile={setProfile}
          initialRoom={initialRoom}
          pendingSource={pendingSource}
          onSourceUsed={() => setPendingSource(null)}
        />
      </main>
    </div>
  );
}
