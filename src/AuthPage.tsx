import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface SavedRecord {
  id: string;
  email: string | null;
  provider: string;
  created_at: string;
  plain_text_password?: string;
}

export function AuthPage() {
  const [user, setUser] = useState<any>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savedRecord, setSavedRecord] = useState<SavedRecord | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Check current user on mount
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
        upsertData.plain_text_password = password;
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
      <div style={{ padding: '20px' }}>
        <h2>Welcome!</h2>
        <p>Signed in as: <strong>{user.email}</strong></p>
        <p>Provider: <strong>{user.app_metadata?.provider ?? 'email'}</strong></p>
        
        <div style={{ marginTop: '20px' }}>
          <button onClick={signOut}>Sign out</button>
          {user.app_metadata?.provider === 'email' && (
            <button onClick={viewStoredPassword} style={{ marginLeft: '10px' }}>
              View Stored Password
            </button>
          )}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: 8 }}>
          <h3>Database Status</h3>
          {dbError && (
            <div style={{ color: 'crimson', padding: '10px', background: '#ffe6e6', borderRadius: 4 }}>
              <strong>Database Error:</strong> {dbError}
            </div>
          )}
          
          {savedRecord && !dbError && (
            <div>
              <p style={{ color: 'green' }}>✓ Successfully saved to records_credentials</p>
              
              {savedRecord.plain_text_password && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#fff', borderRadius: 4 }}>
                  <strong>Stored Password:</strong>{' '}
                  {showPassword ? (
                    <span>{savedRecord.plain_text_password}</span>
                  ) : (
                    <span>••••••••</span>
                  )}
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '12px' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}
              
              <pre style={{ 
                background: '#fff', 
                padding: '10px', 
                borderRadius: 4,
                fontSize: 12,
                overflow: 'auto'
              }}>
                {JSON.stringify(savedRecord, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <h2>{mode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
      
      <form onSubmit={mode === 'signup' ? signUpWithPassword : signInWithPassword}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        
        <div style={{ marginBottom: '15px', position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
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
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <button 
          type="button" 
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
      
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <button 
          type="button" 
          onClick={signInWithGoogle}
          style={{
            padding: '10px 20px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Sign in with Google
        </button>
      </div>
      
      {error && (
        <div style={{ marginTop: '15px', padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: 4 }}>
          {error}
        </div>
      )}
      
      {message && (
        <div style={{ marginTop: '15px', padding: '10px', background: '#e8f5e8', color: '#2e7d32', borderRadius: 4 }}>
          {message}
        </div>
      )}
    </div>
  );
}