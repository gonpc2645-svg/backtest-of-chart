import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_METADATA: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'BACKTEST OF CHART — A Free Historical Market Backtesting Platform',
    description:
      'Explore historical market movements, practise your trading decisions, and evaluate your strategies in a dedicated backtesting environment. No account. No subscription. Just trading practice.',
  },
  '/backtest': {
    title: 'Configure Your Backtest — BACKTEST OF CHART',
    description:
      'Choose your market, timeframe, and historical date to prepare your simulated backtesting session on BACKTEST OF CHART.',
  },
  '/privacy': {
    title: 'Privacy Policy — BACKTEST OF CHART',
    description:
      'Privacy Policy and data handling overview for BACKTEST OF CHART, a free historical market backtesting platform.',
  },
  '/terms': {
    title: 'Terms of Use — BACKTEST OF CHART',
    description:
      'Terms of Use and educational simulation disclaimer for BACKTEST OF CHART.',
  },
  '/contact': {
    title: 'Contact — BACKTEST OF CHART',
    description:
      'Contact information and platform inquiries for BACKTEST OF CHART.',
  },
};

export const ScrollAndMetaManager = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const meta = ROUTE_METADATA[pathname] ?? ROUTE_METADATA['/'];
    document.title = meta.title;

    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.setAttribute('content', meta.description);
    }
  }, [pathname]);

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace('#', '');
      const timer = window.setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 40);
      return () => window.clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname, hash]);

  return null;
};
