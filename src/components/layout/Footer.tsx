import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BRAND_IDENTITY } from '../../data/platformData';
import { BrandLogo } from '../brand/BrandLogo';

export const Footer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Keep Replay Terminal distraction-free
  if (location.pathname.startsWith('/backtest/replay')) {
    return null;
  }

  const handleSectionLink = (
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string | null
  ) => {
    event.preventDefault();
    if (sectionId === null) {
      if (location.pathname === '/') {
        window.history.pushState(null, '', '/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
      return;
    }

    if (location.pathname === '/') {
      const target = document.getElementById(sectionId);
      if (target) {
        window.history.pushState(null, '', `/#${sectionId}`);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate(`/#${sectionId}`);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand-col">
            <Link to="/" className="site-footer__logo-link">
              <BrandLogo showTagline size="md" />
            </Link>
            <p className="site-footer__description">
              Practice. Replay. Analyze. Improve. Built for disciplined traders who
              demand historical accuracy, instant order simulation, and institutional
              performance analytics without expensive monthly paywalls.
            </p>
            <div className="site-footer__badges">
              <span className="tc-glass-pill">100% Free Forever</span>
              <span className="tc-glass-pill">Zero Signup Wall</span>
              <span className="tc-glass-pill">M1 Real Market Data</span>
            </div>
          </div>

          <div className="site-footer__nav-cols site-footer__nav-cols--tc">
            <div className="site-footer__col">
              <h3 className="site-footer__heading">Platform</h3>
              <ul className="site-footer__list">
                <li>
                  <a
                    href="/"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, null)}
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/#features"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'features')}
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="/#supported-markets"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'supported-markets')}
                  >
                    Markets
                  </a>
                </li>
                <li>
                  <a
                    href="/#faq"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'faq')}
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div className="site-footer__col">
              <h3 className="site-footer__heading">Workspace</h3>
              <ul className="site-footer__list">
                <li>
                  <Link to="/backtest" className="site-footer__link">
                    Backtest Setup
                  </Link>
                </li>
                <li>
                  <Link to="/backtest/replay" className="site-footer__link">
                    Bar Replay Terminal
                  </Link>
                </li>
                <li>
                  <Link to="/backtest/analytics" className="site-footer__link">
                    Analytics &amp; Journal
                  </Link>
                </li>
                <li>
                  <a
                    href="/#supported-markets"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'supported-markets')}
                  >
                    Supported Pairs
                  </a>
                </li>
              </ul>
            </div>

            <div className="site-footer__col">
              <h3 className="site-footer__heading">Account &amp; Legals</h3>
              <ul className="site-footer__list">
                <li>
                  <Link to="/login" className="site-footer__link">
                    Log In
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className="site-footer__link">
                    Create Free Account
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="site-footer__link">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="site-footer__link">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="site-footer__link">
                    Contact Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Live Session Schedule / Trading Killzone Reference Strip */}
        <div className="tc-footer-sessions-strip" aria-label="Global Market Killzones Reference">
          <div className="tc-footer-sessions-strip__title">
            <span className="tc-live-dot" />
            <span>GLOBAL TRADING SESSIONS (UTC)</span>
          </div>
          <div className="tc-footer-sessions-strip__items">
            <span><strong>Asian Range:</strong> 00:00 – 07:00 UTC</span>
            <span><strong>London Open:</strong> 07:00 – 12:00 UTC</span>
            <span><strong>NY / London Overlap:</strong> 12:00 – 16:00 UTC</span>
            <span><strong>New York PM:</strong> 16:00 – 21:00 UTC</span>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            &copy; {new Date().getFullYear()} {BRAND_IDENTITY.name}. Simulated Historical Backtesting &amp; Journaling Environment.
          </p>

          <button
            type="button"
            className="tc-ghost-pill tc-back-to-top-btn"
            onClick={scrollToTop}
          >
            <span>Back to top</span>
            <span aria-hidden="true">&uarr;</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
