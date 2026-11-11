import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../brand/BrandLogo';

interface NavSectionItem {
  label: string;
  sectionId: string | null;
  href: string;
  route?: string;
}

const NAV_ITEMS: NavSectionItem[] = [
  { label: 'Home', sectionId: null, href: '/' },
  { label: 'Features', sectionId: 'features', href: '/#features' },
  { label: 'Markets', sectionId: 'supported-markets', href: '/#supported-markets' },
  { label: 'FAQ', sectionId: 'faq', href: '/#faq' },
];

const DRAWER_FEATURES = [
  { label: 'Bar Replay Engine', desc: 'Candle-by-candle market time machine', to: '/backtest' },
  { label: 'Replay Terminal', desc: 'Interactive charting, SL/TP & drawing tools', to: '/backtest/replay' },
  { label: 'Trading Analytics', desc: 'Equity curve, R-multiple & daily P&L calendar', to: '/backtest/analytics' },
  { label: 'Real Market Feeds', desc: 'Binance Vision M1 & Yahoo Institutional OHLCV', to: '/backtest' },
];

export const Navbar: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(true);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isReplayRoute = location.pathname.startsWith('/backtest/replay');

  const userDisplayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Trader';
  const userAvatar = user?.user_metadata?.avatar_url as string | undefined;

  useEffect(() => {
    setDrawerOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountMenuOpen]);

  const handleNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NavSectionItem
  ) => {
    event.preventDefault();
    setDrawerOpen(false);

    if (item.route) {
      navigate(item.route);
      return;
    }

    if (item.sectionId === null) {
      if (location.pathname === '/') {
        window.history.pushState(null, '', '/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
      return;
    }

    if (location.pathname === '/') {
      const target = document.getElementById(item.sectionId);
      if (target) {
        window.history.pushState(null, '', `/#${item.sectionId}`);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate(`/#${item.sectionId}`);
    }
  };

  return (
    <>
      <header
        className={`site-header ${isReplayRoute ? 'site-header--terminal-dock' : 'site-header--floating-pill'}`}
        role="banner"
      >
        <div className="site-header__pill-inner">
          <Link
            to="/"
            className="site-header__brand-link"
            aria-label="BACKTEST OF CHART Home"
            onClick={() => {
              setDrawerOpen(false);
              if (location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <BrandLogo size={isReplayRoute ? 'sm' : 'md'} />
          </Link>

          <nav className="site-nav" aria-label="Primary Navigation">
            <ul className="site-nav__list">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.sectionId === null
                    ? location.pathname === '/' && !location.hash
                    : location.pathname === '/' &&
                      location.hash === `#${item.sectionId}`;
                return (
                  <li key={item.label} className="site-nav__item">
                    <a
                      href={item.href}
                      className={`site-nav__link ${
                        isActive ? 'site-nav__link--active' : ''
                      }`}
                      onClick={(e) => handleNavClick(e, item)}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
              <li className="site-nav__item">
                <Link
                  to="/backtest/replay"
                  className={`site-nav__link ${
                    location.pathname.startsWith('/backtest/replay') ? 'site-nav__link--active' : ''
                  }`}
                >
                  Terminal
                </Link>
              </li>
              <li className="site-nav__item">
                <Link
                  to="/backtest/analytics"
                  className={`site-nav__link ${
                    location.pathname.startsWith('/backtest/analytics') ? 'site-nav__link--active' : ''
                  }`}
                >
                  Analytics
                </Link>
              </li>
            </ul>
          </nav>

          <div className="site-header__actions">
            {user ? (
              <div className="tc-account-menu" ref={accountMenuRef}>
                <button
                  type="button"
                  className="tc-account-pill"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userDisplayName}
                      className="tc-account-pill__avatar"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="tc-account-pill__initial" aria-hidden="true">
                      {userDisplayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="tc-account-pill__name">{userDisplayName}</span>
                </button>

                {accountMenuOpen && (
                  <div className="tc-account-dropdown" role="menu">
                    <div className="tc-account-dropdown__header">
                      <strong>{userDisplayName}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link
                      to="/backtest"
                      className="tc-account-dropdown__item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Configure Backtest
                    </Link>
                    <Link
                      to="/backtest/replay"
                      className="tc-account-dropdown__item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Open Terminal
                    </Link>
                    <Link
                      to="/backtest/analytics"
                      className="tc-account-dropdown__item"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      View Analytics
                    </Link>
                    <button
                      type="button"
                      className="tc-account-dropdown__item tc-account-dropdown__item--danger"
                      role="menuitem"
                      onClick={async () => {
                        setAccountMenuOpen(false);
                        await signOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="tc-auth-nav-link site-header__cta"
                onClick={() => setDrawerOpen(false)}
              >
                Log in
              </Link>
            )}

            <Link
              to="/backtest"
              className="tc-cta-pill tc-cta-pill--sm site-header__cta"
              onClick={() => setDrawerOpen(false)}
            >
              <span>Get started</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <button
              type="button"
              className="tc-circle-menu-btn"
              aria-expanded={drawerOpen}
              aria-controls="tc-slide-drawer"
              aria-label={drawerOpen ? 'Close menu' : 'Open navigation menu'}
              onClick={() => setDrawerOpen((prev) => !prev)}
            >
              {drawerOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 7H20M4 12H20M4 17H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Glass Navigation Sheet / Drawer (Traders Casa Style) */}
      {drawerOpen && (
        <div
          className="tc-drawer-backdrop"
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            id="tc-slide-drawer"
            className="tc-slide-drawer"
            aria-label="Site Drawer Navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tc-slide-drawer__header">
              <BrandLogo size="sm" />
              <button
                type="button"
                className="tc-circle-menu-btn"
                aria-label="Close drawer"
                onClick={() => setDrawerOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="tc-slide-drawer__body">
              <nav className="tc-drawer-nav">
                <a
                  href="/"
                  className="tc-drawer-nav__item"
                  onClick={(e) => handleNavClick(e, NAV_ITEMS[0])}
                >
                  Home
                </a>

                <div className="tc-drawer-nav__group">
                  <button
                    type="button"
                    className="tc-drawer-nav__item tc-drawer-nav__item--toggle"
                    onClick={() => setFeaturesExpanded(!featuresExpanded)}
                  >
                    <span>Platform Modules</span>
                    <span className="tc-drawer-chevron">{featuresExpanded ? '−' : '+'}</span>
                  </button>
                  {featuresExpanded && (
                    <div className="tc-drawer-sublist">
                      {DRAWER_FEATURES.map((f) => (
                        <Link
                          key={f.label}
                          to={f.to}
                          className="tc-drawer-subitem"
                          onClick={() => setDrawerOpen(false)}
                        >
                          <strong>{f.label}</strong>
                          <span>{f.desc}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {NAV_ITEMS.slice(1).map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="tc-drawer-nav__item"
                    onClick={(e) => handleNavClick(e, item)}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="tc-slide-drawer__footer">
              {user ? (
                <div className="tc-drawer-user-box">
                  <div className="tc-drawer-user-box__info">
                    <strong>{userDisplayName}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={async () => {
                      await signOut();
                      setDrawerOpen(false);
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="tc-drawer-auth-row">
                  <Link
                    to="/login"
                    className="tc-ghost-pill tc-ghost-pill--full"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="tc-ghost-pill tc-ghost-pill--full"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              <Link
                to="/backtest/replay"
                className="tc-ghost-pill tc-ghost-pill--full"
                onClick={() => setDrawerOpen(false)}
              >
                Open Terminal
              </Link>
              <Link
                to="/backtest"
                className="tc-cta-pill tc-cta-pill--full"
                onClick={() => setDrawerOpen(false)}
              >
                <span>Start Free Backtest</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
