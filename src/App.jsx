import { useState } from 'react';
import Discover from './components/Discover.jsx';
import WatchParty from './components/WatchParty.jsx';
import History from './components/History.jsx';
import AuthModal from './components/AuthModal.jsx';
import { useProfile } from './lib/storage.js';
import { useAuth, signOut, displayName, authEnabled } from './lib/auth.js';

const WELCOMED_KEY = 'moodflix_welcomed';

export default function App() {
  const initialRoom = new URLSearchParams(window.location.search).get('room');
  const { user, loading } = useAuth();
  const [profile, setProfile, { syncing, syncError }] = useProfile(user);
  const [tab, setTab] = useState(initialRoom ? 'party' : 'discover');
  const [pendingSource, setPendingSource] = useState(null);
  // First visit shows the welcome screen (but not for friends opening an invite link).
  const [authReason, setAuthReason] = useState(() =>
    authEnabled && !initialRoom && !localStorage.getItem(WELCOMED_KEY) ? 'welcome' : null
  );

  /** Returns true if the user may continue; otherwise opens the sign-up window. */
  const requireLogin = (reason) => {
    if (!authEnabled || user) return true;
    setAuthReason(reason);
    return false;
  };

  const closeAuth = () => {
    setAuthReason(null);
    localStorage.setItem(WELCOMED_KEY, '1');
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo"><span className="logo-mark" aria-hidden="true" />moodflix</h1>
        <nav>
          <button className={tab === 'discover' ? 'active' : ''} onClick={() => setTab('discover')}>Discover</button>
          <button className={tab === 'party' ? 'active' : ''} onClick={() => setTab('party')}>Watch Party</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
        </nav>
        {authEnabled && !loading && (
          <div className="account">
            {user ? (
              <>
                <span className="who">👤 {displayName(user)}</span>
                <button onClick={() => signOut()}>Log out</button>
              </>
            ) : (
              <>
                <span className="muted">Guest</span>
                <button onClick={() => setAuthReason('login')}>Log in</button>
                <button className="primary" onClick={() => setAuthReason('signup')}>Sign up</button>
              </>
            )}
          </div>
        )}
      </header>

      {syncing && <p className="muted center">Loading your saved data…</p>}
      {syncError && <div className="card warn">{syncError}</div>}

      {/* Discover and Watch Party stay mounted so switching tabs doesn't drop you out of a room. */}
      <main style={{ display: tab === 'discover' ? 'block' : 'none' }}>
        <Discover
          user={user}
          requireLogin={requireLogin}
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
          user={user}
          requireLogin={requireLogin}
          profile={profile}
          setProfile={setProfile}
          initialRoom={initialRoom}
          pendingSource={pendingSource}
          onSourceUsed={() => setPendingSource(null)}
        />
      </main>
      {tab === 'history' && (
        <main>
          <History
            user={user}
            requireLogin={requireLogin}
            profile={profile}
            setProfile={setProfile}
          />
        </main>
      )}

      {authReason && !user && <AuthModal key={authReason} reason={authReason} onClose={closeAuth} />}
    </div>
  );
}
