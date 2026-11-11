import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/auth/supabaseClient';

export const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [statusMessage, setStatusMessage] = useState('Completing authentication...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(
    searchParams.get('type') === 'recovery'
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const exchangeStarted = useRef(false);

  useEffect(() => {
    const errDesc =
      searchParams.get('error_description') || searchParams.get('error');
    if (errDesc) {
      setErrorMessage(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase authentication client is not configured yet.');
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setStatusMessage('Choose a new password for your account.');
      } else if (session && searchParams.get('type') !== 'recovery') {
        setStatusMessage('Signed in successfully! Redirecting to workspace...');
        window.setTimeout(() => {
          navigate('/backtest', { replace: true });
        }, 700);
      }
    });

    const finalizeOAuth = async () => {
      if (exchangeStarted.current || !supabase) return;
      exchangeStarted.current = true;

      try {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session) {
          if (searchParams.get('type') === 'recovery') {
            setIsRecoveryMode(true);
            setStatusMessage('Choose a new password for your account.');
            return;
          }
          setStatusMessage('Signed in successfully! Redirecting to workspace...');
          window.setTimeout(() => navigate('/backtest', { replace: true }), 600);
          return;
        }

        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMessage(error.message);
            return;
          }
          if (searchParams.get('type') === 'recovery') {
            setIsRecoveryMode(true);
            setStatusMessage('Choose a new password for your account.');
            return;
          }
          setStatusMessage('Signed in successfully! Redirecting to workspace...');
          window.setTimeout(() => navigate('/backtest', { replace: true }), 600);
          return;
        }

        // Wait briefly for hash-token processing if needed
        window.setTimeout(async () => {
          if (!supabase) return;
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            navigate('/backtest', { replace: true });
          } else {
            setErrorMessage(
              'Authentication session could not be verified or the link expired. Please try signing in again.'
            );
          }
        }, 1200);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unexpected authentication callback error.'
        );
      }
    };

    finalizeOAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setErrorMessage(error);
      } else {
        setIsRecoveryMode(false);
        setStatusMessage('Password updated! Redirecting to your workspace...');
        window.setTimeout(() => navigate('/backtest', { replace: true }), 800);
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container auth-page__container">
        <div className="surface-card auth-card">
          {isRecoveryMode ? (
            <>
              <header className="auth-card__header">
                <div className="section-eyebrow">ACCOUNT RECOVERY</div>
                <h1 className="auth-card__title">
                  Set new <span className="tc-serif-accent">password.</span>
                </h1>
                <p className="auth-card__subtitle">
                  Enter a strong password to complete your account recovery.
                </p>
              </header>

              {errorMessage && (
                <div className="auth-alert auth-alert--error" role="alert">
                  {errorMessage}
                </div>
              )}

              <form className="auth-form" onSubmit={handlePasswordUpdate}>
                <div className="auth-field">
                  <label htmlFor="new-password" className="auth-field__label">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    className="auth-field__input"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="confirm-new-password" className="auth-field__label">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    required
                    minLength={6}
                    className="auth-field__input"
                    placeholder="Re-enter password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn--primary btn--full"
                  disabled={updatingPassword}
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          ) : errorMessage ? (
            <div className="auth-callback-state">
              <div className="section-eyebrow">AUTHENTICATION NOTICE</div>
              <h1 className="auth-card__title">Sign-in incomplete</h1>
              <div className="auth-alert auth-alert--error" role="alert">
                {errorMessage}
              </div>
              <div className="auth-signed-in-actions" style={{ marginTop: 18 }}>
                <Link to="/login" className="btn btn--primary btn--full">
                  Return to Log In
                </Link>
                <Link to="/backtest" className="btn btn--secondary btn--full">
                  Continue as Guest
                </Link>
              </div>
            </div>
          ) : (
            <div className="auth-loading-state">
              <span className="auth-spinner" aria-hidden="true" />
              <p>{statusMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
