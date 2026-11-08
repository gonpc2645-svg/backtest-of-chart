import {
  DataSourceItem,
  EducationalPoint,
  FaqItem,
  FeatureItem,
  MarketCategory,
  TimeframeOption,
  WorkflowStep,
} from '../types/backtest';

export const BRAND_IDENTITY = {
  name: 'BACKTEST OF CHART',
  tagline: 'Practice. Replay. Analyze. Improve.',
  positioning: 'A Free Historical Market Backtesting Platform.',
  disclaimer:
    'Backtest of Chart is an educational and historical market analysis platform. All trading activity within the platform is simulated. No real orders are executed and no financial returns are guaranteed. Historical performance does not guarantee future results.',
} as const;

export const MARKET_CATEGORIES: MarketCategory[] = [
  {
    id: 'forex',
    name: 'Forex',
    code: 'FX',
    description:
      'Major, minor, and cross currency pairs planned for historical price replay and multi-session structure study.',
    intendedSource: 'Dukascopy',
    statusLabel: 'Intended Market — Phase 2 Integration',
    instrumentSchemaNote:
      'Currency pair symbol directory (Dukascopy historical feed) is scheduled for connection in Phase 2.',
  },
  {
    id: 'metals',
    name: 'Metals',
    code: 'MTL',
    description:
      'Precious metals spot instruments intended for studying historical volatility, liquidity sweeps, and session trends.',
    intendedSource: 'Dukascopy',
    statusLabel: 'Intended Market — Phase 2 Integration',
    instrumentSchemaNote:
      'Spot metals symbol catalogue (Dukascopy historical feed) is scheduled for connection in Phase 2.',
  },
  {
    id: 'indices',
    name: 'Indices',
    code: 'IDX',
    description:
      'Global equity index instruments planned for analysing market open behaviour, session momentum, and structural levels.',
    intendedSource: 'Dukascopy',
    statusLabel: 'Intended Market — Phase 2 Integration',
    instrumentSchemaNote:
      'Global index symbol catalogue (Dukascopy historical feed) is scheduled for connection in Phase 2.',
  },
  {
    id: 'crypto',
    name: 'Cryptocurrency',
    code: 'CRP',
    description:
      'Digital asset pairs intended for continuous 24/7 historical Kline replay and multi-timeframe market analysis.',
    intendedSource: 'Binance',
    statusLabel: 'Intended Market — Phase 2 Integration',
    instrumentSchemaNote:
      'Cryptocurrency historical Kline symbol list (Binance feed) is scheduled for connection in Phase 2.',
  },
];

export const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { id: 'M1', label: 'M1', fullName: '1 Minute', category: 'Intraday' },
  { id: 'M5', label: 'M5', fullName: '5 Minutes', category: 'Intraday' },
  { id: 'M15', label: 'M15', fullName: '15 Minutes', category: 'Intraday' },
  { id: 'M30', label: 'M30', fullName: '30 Minutes', category: 'Intraday' },
  { id: 'H1', label: 'H1', fullName: '1 Hour', category: 'Intraday' },
  { id: 'H4', label: 'H4', fullName: '4 Hours', category: 'Swing / Daily' },
  { id: 'D1', label: 'D1', fullName: '1 Day', category: 'Swing / Daily' },
];

export const PLANNED_FEATURES: FeatureItem[] = [
  {
    id: 'historical-market-replay',
    title: 'Historical Market Replay',
    phaseBadge: 'Planned Capability — Phase 3',
    statusNote: 'Engine in development (Not active in Phase 1)',
    description:
      'Step through historical price action candle by candle at controlled speeds to observe how market structures unfold without hindsight bias.',
    highlights: [
      'Candle-by-candle progression controls',
      'Adjustable replay speed & pause states',
      'Historical timestamp jump & session navigation',
    ],
  },
  {
    id: 'advanced-chart-analysis',
    title: 'Advanced Chart Analysis',
    phaseBadge: 'Planned Capability — Phase 6',
    statusNote: 'Subject to charting integration & licensing approval',
    description:
      'Inspect multi-timeframe price behaviour in a structured charting workspace designed for technical study and price action evaluation.',
    highlights: [
      'Multi-timeframe switching (M1 through D1)',
      'Clean dark-terminal visual hierarchy',
      'Designed for future TradingView Advanced Charts integration (subject to approval)',
    ],
  },
  {
    id: 'simulated-trading',
    title: 'Simulated Trading',
    phaseBadge: 'Planned Capability — Phase 4',
    statusNote: 'Simulation engine planned (Not active in Phase 1)',
    description:
      'Practise executing simulated market and pending decisions during historical replay in a risk-free educational environment.',
    highlights: [
      '100% simulated order placement environment',
      'Zero real capital or brokerage connection required',
      'Instant decision feedback against historical candles',
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    phaseBadge: 'Planned Capability — Phase 4',
    statusNote: 'Risk calculation engine planned (Not active in Phase 1)',
    description:
      'Define stop-loss, take-profit, and position sizing parameters before entering simulated setups to build disciplined risk habits.',
    highlights: [
      'Pre-trade risk-to-reward structuring',
      'Stop-loss and target level definition',
      'Consistent position sizing discipline',
    ],
  },
  {
    id: 'trade-history',
    title: 'Trade History',
    phaseBadge: 'Planned Capability — Phase 4 & 5',
    statusNote: 'Session log module planned (Not active in Phase 1)',
    description:
      'Review a chronological ledger of every simulated trade taken during your backtesting session, including entry, exit, and outcome details.',
    highlights: [
      'Complete chronological log of simulated trades',
      'Entry and exit timestamp auditing',
      'Review individual trade execution decisions',
    ],
  },
  {
    id: 'performance-analytics',
    title: 'Performance Analytics',
    phaseBadge: 'Planned Capability — Phase 5',
    statusNote: 'Analytics module planned (Not active in Phase 1)',
    description:
      'Evaluate your simulated session results through objective statistical metrics to identify strengths and recurring execution errors.',
    highlights: [
      'Win/loss distribution & expectancy overview',
      'Drawdown and consistency observation',
      'Educational review of strategy behaviour',
    ],
  },
];

export const DATA_SOURCES: DataSourceItem[] = [
  {
    id: 'dukascopy',
    name: 'Dukascopy',
    wordmarkStyle: 'DUKASCOPY',
    statusBadge: 'Planned Integration — Phase 2',
    intendedMarkets: ['Forex', 'Metals', 'Indices'],
    description:
      'Intended source for Forex, Metals, and Indices historical data.',
    technicalScope:
      'Neither provider is connected in Phase 1. Historical price feeds, symbol lists, and verified date ranges will be connected during Phase 2 backend integration.',
  },
  {
    id: 'binance',
    name: 'Binance',
    wordmarkStyle: 'BINANCE',
    statusBadge: 'Planned Integration — Phase 2',
    intendedMarkets: ['Cryptocurrency'],
    description:
      'Intended source for Cryptocurrency historical Klines.',
    technicalScope:
      'Neither provider is connected in Phase 1. Historical Kline pipelines and cryptocurrency pair lists will be connected during Phase 2 backend integration.',
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    stepNumber: '01',
    title: 'Open Backtest',
    description:
      'Launch the Backtest Setup interface directly from the homepage with no account registration, login wall, or subscription required.',
    phaseAvailability: 'Available in Phase 1 UI',
    isAvailableInPhase1: true,
  },
  {
    stepNumber: '02',
    title: 'Select a market and instrument',
    description:
      'Choose your target asset class (Forex, Metals, Indices, or Cryptocurrency) and select an instrument once historical symbol feeds are connected.',
    phaseAvailability: 'Market Selector UI Ready • Instrument Feed in Phase 2',
    isAvailableInPhase1: true,
  },
  {
    stepNumber: '03',
    title: 'Choose a timeframe and historical date',
    description:
      'Configure your chart resolution (M1 to D1, defaulting to M15) and specify the historical starting date for your session.',
    phaseAvailability: 'Selector UI Ready • Date Coverage Bound in Phase 2',
    isAvailableInPhase1: true,
  },
  {
    stepNumber: '04',
    title: 'Start historical replay',
    description:
      'Load the historical workspace and advance through market candles step by step to observe price action as it developed.',
    phaseAvailability: 'Planned — Phase 3 Replay Engine',
    isAvailableInPhase1: false,
  },
  {
    stepNumber: '05',
    title: 'Practise simulated trading',
    description:
      'Test your market entries, exits, and risk management rules in a purely simulated environment without risking real capital.',
    phaseAvailability: 'Planned — Phase 4 Trading & Risk Engine',
    isAvailableInPhase1: false,
  },
  {
    stepNumber: '06',
    title: 'Review performance',
    description:
      'Inspect your simulated trade history and session analytics to study decision quality and trading consistency.',
    phaseAvailability: 'Planned — Phase 5 Analytics Engine',
    isAvailableInPhase1: false,
  },
];

export const WHY_BACKTESTING_POINTS: EducationalPoint[] = [
  {
    id: 'zero-financial-risk',
    title: 'Practise without risking real money',
    description:
      'Test setups, refine execution timing, and learn how markets react in a 100% simulated environment with zero financial exposure.',
  },
  {
    id: 'evaluate-decisions',
    title: 'Evaluate trading decisions',
    description:
      'Step through historical price movements bar by bar to test whether your entry and exit criteria hold up under objective observation.',
  },
  {
    id: 'study-market-behaviour',
    title: 'Study historical market behaviour',
    description:
      'Observe how different asset classes behave across sessions, consolidations, breakouts, and high-volatility historical periods.',
  },
  {
    id: 'understand-risk',
    title: 'Understand risk management',
    description:
      'See the direct impact of stop-loss placement, risk-to-reward ratios, and disciplined invalidation rules across a series of simulated trades.',
  },
  {
    id: 'review-consistency',
    title: 'Review trading consistency',
    description:
      'Identify recurring habits and emotional biases by reviewing a structured log of simulated decisions rather than relying on memory.',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-free',
    question: 'Is Backtest of Chart free?',
    answer: 'Yes. The platform is intended to be completely free to use.',
  },
  {
    id: 'faq-account',
    question: 'Do I need to create an account?',
    answer: 'No. There is no login or signup requirement.',
  },
  {
    id: 'faq-markets',
    question: 'Which markets will be supported?',
    answer: 'Forex, Metals, Indices, and Cryptocurrency are planned.',
  },
  {
    id: 'faq-data-sources',
    question: 'Where will historical data come from?',
    answer:
      'We plan to use Dukascopy for Forex, Metals, and Indices, and Binance for Cryptocurrency.',
  },
  {
    id: 'faq-real-trades',
    question: 'Will real trades be executed?',
    answer:
      'No. Trading activity inside this platform is intended for simulation only.',
  },
  {
    id: 'faq-mobile',
    question: 'Can I use this platform on mobile?',
    answer:
      'The website is being designed for desktop, tablet, and mobile devices.',
  },
];
