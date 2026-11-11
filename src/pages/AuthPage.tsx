import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

const GoogleLogoSvg: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6.01-2.19-7-5.14H1.01v3.14C3.05 21.22 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5 14.03c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.17H1.01C.37 7.45 0 8.89 0 10.42s.37 2.97 1.01 4.25L5 14.03Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.78 1.01 6.17L5 9.31c.99-2.95 3.75-4.56 7-4.56Z"
    />
  </svg>
);

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    loading,
    isConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode]);

  const redirectAfterAuth =
    (location.state as { from?: string } | null)?.from || '/backtest';

  const switchMode = (nextMode: AuthMode) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setMode(nextMode);
    if (nextMode === 'login' && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    } else if (nextMode === 'signup' && location.pathname !== '/signup') {
      navigate('/signup', { replace: true });
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGoogleSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setSubmitting(true);
      try {
        const { error } = await sendPasswordReset(trimmedEmail);
        if (error) {
          setErrorMsg(error);
        } else {
          setSuccessMsg(
            `Password reset link sent to ${trimmedEmail}. Please check your inbox (and spam folder).`
          );
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter the same password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(trimmedEmail, password);
        if (error) {
          setErrorMsg(error);
        } else {
          navigate(redirectAfterAuth, { replace: true });
        }
      } else {
        const { error, requiresEmailConfirmation } = await signUpWithEmail(
          trimmedEmail,
          password,
          fullName
        );
        if (error) {
          setErrorMsg(error);
        } else if (requiresEmailConfirmation) {
          setSuccessMsg(
            `Verification link sent to ${trimmedEmail}. Please confirm your email to complete signup.`
          );
        } else {
          navigate(redirectAfterAuth, { replace: true });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const userDisplayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Trader';
  const userAvatar = user?.user_metadata?.avatar_url as string | undefined;
  const authProvider =
    (user?.app_metadata?.provider as string | undefined) || 'email';
  const authProviderLabel =
    authProvider === 'google'
      ? 'Google OAuth'
      : authProvider === 'local_db'
      ? 'Email (Local Database)'
      : authProvider === 'local_device'
      ? 'Email (Saved on Device)'
      : 'Cloud Email';

  return (
    <div className="auth-page">
      <div className="tc-dot-grid" aria-hidden="true" />
      <div className="tc-aurora tc-aurora--cyan" aria-hidden="true" />
      <div className="tc-aurora tc-aurora--blue" aria-hidden="true" />

      <div className="container auth-page__container">
        <div className="auth-page__topbar">
          <Link to="/" className="back-home-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M19 12H5M5 12L11 18M5 12L11 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back to Home</span>
          </Link>

          <span className="status-pill status-pill--cyan">
            Optional Free Account
          </span>
        </div>

        <div className="surface-card auth-card">
          {loading ? (
            <div className="auth-loading-state">
              <span className="auth-spinner" aria-hidden="true" />
              <p>Checking session status...</p>
            </div>
          ) : user ? (
            <div className="auth-signed-in-panel">
              <div className="section-eyebrow">AUTHENTICATED SESSION</div>
              <div className="auth-profile-banner">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userDisplayName}
                    className="auth-avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="auth-avatar-fallback" aria-hidden="true">
                    {userDisplayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="auth-profile-meta">
                  <h1 className="auth-profile-name">{userDisplayName}</h1>
                  <p className="auth-profile-email">{user.email}</p>
                  <span className="status-pill status-pill--green">
                    Connected via {authProviderLabel}
                  </span>
                </div>
              </div>

              <div className="auth-signed-in-actions">
                <Link to="/backtest" className="btn btn--primary btn--full">
                  <span>Configure Backtest Session</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <div className="auth-signed-in-secondary">
                  <Link to="/backtest/replay" className="btn btn--secondary btn--sm">
                    Open Replay Terminal
                  </Link>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <header className="auth-card__header">
                <div className="section-eyebrow">BACKTEST OF CHART ACCOUNT</div>
                <h1 className="auth-card__title">
                  {mode === 'login' ? (
                    <>
                      Welcome <span className="tc-serif-accent">back.</span>
                    </>
                  ) : mode === 'signup' ? (
                    <>
                      Create free <span className="tc-serif-accent">account.</span>
                    </>
                  ) : (
                    <>
                      Reset <span className="tc-serif-accent">password.</span>
                    </>
                  )}
                </h1>
                <p className="auth-card__subtitle">
                  {mode === 'login'
                    ? 'Sign in with Google or Email to sync your free trader profile.'
                    : mode === 'signup'
                    ? 'Join Backtest of Chart for free using Google or your email address.'
                    : 'Enter your email and we will send you a secure password recovery link.'}
                </p>
              </header>

              {mode !== 'forgot' && (
                <div className="auth-mode-tabs" role="tablist" aria-label="Authentication Mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'login'}
                    className={`auth-mode-tab ${mode === 'login' ? 'auth-mode-tab--active' : ''}`}
                    onClick={() => switchMode('login')}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                    className={`auth-mode-tab ${mode === 'signup' ? 'auth-mode-tab--active' : ''}`}
                    onClick={() => switchMode('signup')}
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {errorMsg && (
                <div className="auth-alert auth-alert--error" role="alert">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="auth-alert auth-alert--success" role="status">
                  {successMsg}
                </div>
              )}

              {mode !== 'forgot' && (
                <>
                  <button
                    type="button"
                    className="auth-google-btn"
                    disabled={googleSubmitting || submitting}
                    onClick={handleGoogleAuth}
                  >
                    <GoogleLogoSvg />
                    <span>
                      {googleSubmitting
                        ? 'Connecting to Google...'
                        : mode === 'signup'
                        ? 'Sign up with Google'
                        : 'Continue with Google'}
                    </span>
                  </button>

                  <div className="auth-divider" aria-hidden="true">
                    <span>or continue with email</span>
                  </div>
                </>
              )}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {mode === 'signup' && (
                  <div className="auth-field">
                    <label htmlFor="auth-full-name" className="auth-field__label">
                      Full Name (Optional)
                    </label>
                    <input
                      id="auth-full-name"
                      type="text"
                      className="auth-field__input"
                      placeholder="e.g. Nahiyan Sheikh"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}

                <div className="auth-field">
                  <label htmlFor="auth-email" className="auth-field__label">
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    className="auth-field__input"
                    placeholder="trader@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {mode !== 'forgot' && (
                  <div className="auth-field">
                    <div className="auth-field__label-row">
                      <label htmlFor="auth-password" className="auth-field__label">
                        Password
                      </label>
                      {mode === 'login' && isConfigured && (
                        <button
                          type="button"
                          className="auth-text-link"
                          onClick={() => switchMode('forgot')}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="auth-password-wrap">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        className="auth-field__input"
                        placeholder={
                          mode === 'signup' ? 'At least 6 characters' : 'Enter your password'
                        }
                        autoComplete={
                          mode === 'signup' ? 'new-password' : 'current-password'
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="auth-field">
                    <label htmlFor="auth-confirm-password" className="auth-field__label">
                      Confirm Password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="auth-field__input"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--full auth-submit-btn"
                  disabled={submitting || googleSubmitting}
                >
                  {submitting
                    ? 'Please wait...'
                    : mode === 'login'
                    ? 'Sign In with Email'
                    : mode === 'signup'
                    ? 'Create Free Account'
                    : 'Send Password Reset Link'}
                </button>

                {mode === 'forgot' && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--full"
                    onClick={() => switchMode('login')}
                  >
                    Back to Log In
                  </button>
                )}
              </form>

              <footer className="auth-card__footer">
                <p>
                  No account required to practice &mdash;{' '}
                  <Link to="/backtest" className="auth-guest-link">
                    Continue as Guest &rarr;
                  </Link>
                </p>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
