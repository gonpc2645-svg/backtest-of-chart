export type MarketCategoryId = 'forex' | 'metals' | 'indices' | 'crypto';

export type TimeframeId = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export interface MarketCategory {
  id: MarketCategoryId;
  name: string;
  code: string;
  description: string;
  intendedSource: 'Dukascopy' | 'Binance';
  statusLabel: string;
  instrumentSchemaNote: string;
}

export interface TimeframeOption {
  id: TimeframeId;
  label: string;
  fullName: string;
  category: 'Intraday' | 'Swing / Daily';
}

export interface FeatureItem {
  id: string;
  title: string;
  phaseBadge: string;
  statusNote: string;
  description: string;
  highlights: string[];
}

export interface DataSourceItem {
  id: 'dukascopy' | 'binance';
  name: string;
  wordmarkStyle: string;
  statusBadge: string;
  intendedMarkets: string[];
  description: string;
  technicalScope: string;
}

export interface WorkflowStep {
  stepNumber: string;
  title: string;
  description: string;
  phaseAvailability: string;
  isAvailableInPhase1: boolean;
}

export interface EducationalPoint {
  id: string;
  title: string;
  description: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BacktestSetupState {
  market: MarketCategoryId;
  instrumentQuery: string;
  timeframe: TimeframeId;
  targetDate: string;
}
