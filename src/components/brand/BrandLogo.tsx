import React from 'react';
import { BRAND_IDENTITY } from '../../data/platformData';

interface BrandLogoProps {
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  showTagline = false,
  size = 'md',
}) => {
  const iconDimensions = size === 'sm' ? 28 : size === 'lg' ? 42 : 34;

  return (
    <span className={`brand-logo brand-logo--${size}`}>
      <svg
        width={iconDimensions}
        height={iconDimensions}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo__icon tc-emblem-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tcCrestBg" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#17D0E4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1576DB" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="tcCrestStroke" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2EE6F2" />
            <stop offset="60%" stopColor="#0AA3D4" />
            <stop offset="100%" stopColor="#1576DB" />
          </linearGradient>
          <linearGradient id="tcFlameCyan" x1="18" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ECFEFF" />
            <stop offset="45%" stopColor="#2EE6F2" />
            <stop offset="100%" stopColor="#0AA3D4" />
          </linearGradient>
        </defs>

        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx="16"
          fill="#02273D"
          stroke="url(#tcCrestStroke)"
          strokeWidth="1.8"
        />
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="13"
          fill="url(#tcCrestBg)"
        />
        {/* Dynamic Bull Horn + Ascending Price Momentum Crest */}
        <path
          d="M15 20C18 26 24 29 32 29C40 29 46 26 49 20C48 28 42 34 32 34C22 34 16 28 15 20Z"
          fill="url(#tcFlameCyan)"
        />
        {/* 3 Crisp Illuminated Candlesticks */}
        <line x1="21" y1="31" x2="21" y2="49" stroke="#86F6FB" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="18.2" y="35" width="5.6" height="9" rx="1.6" fill="#0AA3D4" />

        <line x1="32" y1="24" x2="32" y2="49" stroke="#2EE6F2" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="29.2" y="29" width="5.6" height="13" rx="1.6" fill="#2EE6F2" />

        <line x1="43" y1="18" x2="43" y2="46" stroke="#ECFEFF" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="40.2" y="22" width="5.6" height="14" rx="1.6" fill="url(#tcFlameCyan)" />
      </svg>

      <span className="brand-logo__text-group">
        <span className="brand-logo__wordmark tc-wordmark">
          <span className="tc-wordmark__sans">BACKTEST</span>{' '}
          <span className="tc-wordmark__serif">ofChart</span>
        </span>
        {showTagline && (
          <span className="brand-logo__tagline">{BRAND_IDENTITY.tagline}</span>
        )}
      </span>
    </span>
  );
};
