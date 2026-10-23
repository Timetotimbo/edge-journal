import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  };
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <img src="/gospel-logo.png" alt="Gospel Trading Academy" className="w-40 h-40 mx-auto" />
        <div className="text-xl font-extrabold text-center">Edge Journal</div>
        <p className="text-sm text-mute">Sign in with your Social Bloom email and password.</p>
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="field" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="field" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {error && <p className="text-sm text-loss">{error}</p>}
        <button className="btn-edge w-full h-10" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
