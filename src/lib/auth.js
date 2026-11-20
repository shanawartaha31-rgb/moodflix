import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export const authEnabled = Boolean(supabase);

/** Current logged-in user (null for guests). */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(authEnabled);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { user: session?.user ?? null, loading };
}

export async function signUp({ email, password, name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  // With "Confirm email" on, Supabase returns no session until the link is clicked.
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export const signOut = () => supabase.auth.signOut();

export const displayName = (user) =>
  user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';

/** Turns Supabase error messages into friendly ones. */
export function friendlyAuthError(err) {
  const m = err?.message || String(err);
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox (and spam).';
  if (/already registered|already exists/i.test(m)) return 'An account with this email already exists — log in instead.';
  if (/rate limit/i.test(m)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/password/i.test(m) && /6/.test(m)) return 'Password must be at least 6 characters.';
  return m;
}
