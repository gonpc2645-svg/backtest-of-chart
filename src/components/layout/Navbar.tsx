import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../brand/BrandLogo';

interface NavSectionItem {
  label: string;
  sectionId: string | null;
  href: string;
}

const NAV_ITEMS: NavSectionItem[] = [
  { label: 'Home', sectionId: null, href: '/' },
  { label: 'About', sectionId: 'about', href: '/#about' },
  { label: 'Features', sectionId: 'features', href: '/#features' },
  {
    label: 'Supported Markets',
    sectionId: 'supported-markets',
    href: '/#supported-markets',
  },
  { label: 'How It Works', sectionId: 'how-it-works', href: '/#how-it-works' },
  { label: 'FAQ', sectionId: 'faq', href: '/#faq' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NavSectionItem
  ) => {
    event.preventDefault();
    setMobileMenuOpen(false);

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
    <header className="site-header" role="banner">
      <div className="container site-header__inner">
        <Link
          to="/"
          className="site-header__brand-link"
          aria-label="BACKTEST OF CHART Home"
          onClick={() => {
            setMobileMenuOpen(false);
            if (location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <BrandLogo size="md" />
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
          </ul>
        </nav>

        <div className="site-header__actions">
          <Link
            to="/backtest"
            className="btn btn--primary btn--sm site-header__cta"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>Start Backtest</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L13 6M19 12L13 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <button
            type="button"
            className="site-header__menu-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
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

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-navigation-drawer"
        className={`mobile-nav ${mobileMenuOpen ? 'mobile-nav--open' : ''}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="container mobile-nav__inner">
          <ul className="mobile-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label} className="mobile-nav__item">
                <a
                  href={item.href}
                  className="mobile-nav__link"
                  onClick={(e) => handleNavClick(e, item)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mobile-nav__cta-wrapper">
            <Link
              to="/backtest"
              className="btn btn--primary btn--full"
              onClick={() => setMobileMenuOpen(false)}
            >
              Start Backtest
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
