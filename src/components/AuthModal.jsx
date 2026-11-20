import { useState } from 'react';
import { signIn, signUp, friendlyAuthError } from '../lib/auth.js';
import { GUEST_FREE_RUNS } from '../lib/storage.js';

/**
 * reason:
 *  'welcome' – first visit: sign up, log in, or try as guest
 *  'login' / 'signup' – opened from a button
 *  any other text – a guest hit a members-only feature; the text explains why
 */
export default function AuthModal({ reason, onClose }) {
  const welcome = reason === 'welcome';
  const custom = !['welcome', 'login', 'signup'].includes(reason);
  const [mode, setMode] = useState(reason === 'login' ? 'login' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const { needsConfirmation } = await signUp({ email: email.trim(), password, name: name.trim() });
        if (needsConfirmation) {
          setInfo(`Almost done! We sent a confirmation link to ${email.trim()}. Open it, then log in here.`);
          setMode('login');
        }
      } else {
        await signIn({ email: email.trim(), password });
      }
      // On success the app closes this window automatically.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} title="Close">×</button>

        <h2>{welcome ? 'Welcome to MoodFlix 🎬' : mode === 'signup' ? 'Create your free account' : 'Log in'}</h2>
        {welcome && <p className="muted">Movies picked for your mood, and a room to watch them together with friends.</p>}
        {custom && <p className="gate">🔒 {reason}</p>}

        {mode === 'signup' && (
          <ul className="perks">
            <li>✅ Unlimited mood-based suggestions</li>
            <li>✅ Create watch party rooms and use Group mood</li>
            <li>✅ Your watch history and likes saved on every device</li>
          </ul>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Password (at least 6 characters)' : 'Password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
          {error && <p className="warn-text">{error}</p>}
          {info && <p className="info-text">{info}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="muted center">
          {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
          <button className="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>
            {mode === 'signup' ? 'Log in' : 'Create an account'}
          </button>
        </p>

        <button className="guest" onClick={onClose}>
          {welcome ? `Try it as a guest first (${GUEST_FREE_RUNS} free suggestions)` : 'Continue as guest'}
        </button>
      </div>
    </div>
  );
}
