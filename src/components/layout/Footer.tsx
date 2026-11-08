import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BRAND_IDENTITY } from '../../data/platformData';
import { BrandLogo } from '../brand/BrandLogo';

export const Footer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand-col">
            <Link to="/" className="site-footer__logo-link">
              <BrandLogo showTagline size="md" />
            </Link>
            <p className="site-footer__description">
              {BRAND_IDENTITY.positioning} Designed to help traders study
              historical price movements, replay market sessions, and evaluate
              simulated trading decisions in a risk-free environment.
            </p>
            <div className="site-footer__badges">
              <span className="status-pill status-pill--cyan">
                100% Free Platform
              </span>
              <span className="status-pill status-pill--neutral">
                No Account Required
              </span>
              <span className="status-pill status-pill--neutral">
                Simulation Only
              </span>
            </div>
          </div>

          <div className="site-footer__nav-cols">
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
                    href="/#about"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'about')}
                  >
                    About
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
                    href="/#faq"
                    className="site-footer__link"
                    onClick={(e) => handleSectionLink(e, 'faq')}
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <Link to="/backtest" className="site-footer__link">
                    Backtest Setup
                  </Link>
                </li>
              </ul>
            </div>

            <div className="site-footer__col">
              <h3 className="site-footer__heading">Legal &amp; Support</h3>
              <ul className="site-footer__list">
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
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            &copy; {new Date().getFullYear()} {BRAND_IDENTITY.name}. All rights
            reserved. Independent Historical Market Backtesting Platform.
          </p>
          <p className="site-footer__tagline-text">{BRAND_IDENTITY.tagline}</p>
        </div>
      </div>
    </footer>
  );
};
