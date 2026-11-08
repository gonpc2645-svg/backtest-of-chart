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
  const iconDimensions = size === 'sm' ? 30 : size === 'lg' ? 42 : 36;

  return (
    <span className={`brand-logo brand-logo--${size}`}>
      <svg
        width={iconDimensions}
        height={iconDimensions}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo__icon"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="14"
          fill="#090D16"
          stroke="#1E293B"
          strokeWidth="2"
        />
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="10"
          stroke="#0EA5E9"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        {/* Historical Replay Timeline Track */}
        <path
          d="M14 48H50"
          stroke="#1E293B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M14 48H38"
          stroke="#06B6D4"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="38" cy="48" r="3.2" fill="#22D3EE" />
        {/* Candle 1 */}
        <line
          x1="19"
          y1="22"
          x2="19"
          y2="41"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="16" y="27" width="6" height="10" rx="1.5" fill="#2563EB" />
        {/* Candle 2 */}
        <line
          x1="31"
          y1="18"
          x2="31"
          y2="38"
          stroke="#64748B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect
          x="28"
          y="23"
          width="6"
          height="9"
          rx="1.5"
          fill="#334155"
          stroke="#94A3B8"
          strokeWidth="1"
        />
        {/* Candle 3 */}
        <line
          x1="43"
          y1="14"
          x2="43"
          y2="36"
          stroke="#22D3EE"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="40" y="18" width="6" height="13" rx="1.5" fill="#06B6D4" />
      </svg>
      <span className="brand-logo__text-group">
        <span className="brand-logo__wordmark">
          BACKTEST <span className="brand-logo__wordmark-accent">OF CHART</span>
        </span>
        {showTagline && (
          <span className="brand-logo__tagline">{BRAND_IDENTITY.tagline}</span>
        )}
      </span>
    </span>
  );
};
