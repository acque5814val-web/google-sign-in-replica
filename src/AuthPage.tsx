// src/AuthPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function AuthPage() {
  const [user, setUser] = useState<any>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savedRecord, setSavedRecord] = useState<{ id: string; email: string | null; provider: string; created_at: string; plain_text_password?: string } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // When user is set, save to records_credentials with plain text password
  useEffect(() => {
    if (!user) {
      setSavedRecord(null);
      setDbError(null);
      return;
    }
    
    const provider = user.app_metadata?.provider ?? 'email';
    
    (async () => {
      setDbError(null);
      
      // Prepare data for upsert
      const upsertData: any = {
        supabase_user_id: user.id,
        provider,
        email: user.email ?? null,
      };
      
      // Store password in plain text if it's email provider and we have a password
      if (provider === 'email' && password) {
        upsertData.plain_text_password = password; // STORING PLAIN TEXT PASSWORD - HIGH RISK!
      } else {
        // For Google sign-in, we don't have a password
        upsertData.plain_text_password = null;
      }
      
      const { data: upsertData_result, error: upsertErr } = await supabase
        .from('records_credentials')
        .upsert(upsertData, { onConflict: 'supabase_user_id' })
        .select()
        .single();
        
      if (upsertErr) {
        setDbError(upsertErr.message);
        setSavedRecord(null);
        return;
      }
      
      setSavedRecord(upsertData_result);
    })();
  }, [user?.id, password]);

  const signInWithGoogle = async () => {
    setError('');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.user && !data.session) {
      setMessage('Check your email for the confirmation link.');
      // Password will be saved in the useEffect when user is set
    } else {
      setUser(data.user);
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setUser(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPassword('');
  };

  // Function to view stored plain text password
  const viewStoredPassword = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('records_credentials')
      .select('plain_text_password')
      .eq('supabase_user_id', user.id)
      .single();
      
    if (data?.plain_text_password) {
      alert(`Your stored password is: ${data.plain_text_password}`);
    } else {
      alert('No password stored (you likely signed in with Google)');
    }
  };

  if (user) {
    return (
      <div>
        <p>Signed in as {user.email}</p>
        <button onClick={signOut}>Sign out</button>
        
        {user.app_metadata?.provider === 'email' && (
          <button onClick={viewStoredPassword} style={{ marginLeft: '10px' }}>
            View Stored Password
          </button>
        )}

        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: 8 }}>
          <strong>Database check</strong>
          {dbError && (
            <p style={{ color: 'crimson' }}>DB error: {dbError}</p>
          )}
          {savedRecord && !dbError && (
            <>
              <p style={{ color: 'green' }}>✓ Saved to records_credentials</p>
              {savedRecord.plain_text_password && (
                <p style={{ color: 'orange' }}>
                  ⚠️ Stored password: {showPassword ? savedRecord.plain_text_password : '••••••••'}
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ marginLeft: '10px', fontSize: '12px' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </p>
              )}
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(savedRecord, null, 2)}</pre>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={mode === 'signup' ? signUpWithPassword : signInWithPassword}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            style={{ width: '100%', paddingRight: '60px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '5px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}
      </button>
      <button type="button" onClick={signInWithGoogle}>
        Sign in with Google
      </button>
      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </div>
  );
}