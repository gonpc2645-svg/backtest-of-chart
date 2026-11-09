import { LegendOHLC } from '../../components/replay/ReplayChartAdapter';
import { ReplayCandleData, TimeframeId } from '../replay/types';
import { Order, Position } from '../trading/TradingTypes';

export interface IChartAdapter {
  initialize(container: HTMLElement, onLegend?: (data: LegendOHLC | null) => void): void | Promise<void>;
  setCandles(candles: ReplayCandleData[]): void;
  updateCandle(candle: ReplayCandleData): void;
  updateTradeOverlays(positions: Position[], pendingOrders: Order[]): void;
  setTimeframe?(timeframe: TimeframeId): void;
  fitContent(): void;
  dispose(): void;
}

export type ChartEngineType = 'LIGHTWEIGHT_CHARTS' | 'ADVANCED_CHARTS';

export interface ChartEngineStatus {
  activeEngine: ChartEngineType;
  advancedChartsAvailable: boolean;
  missingPrerequisites?: string[];
}

export class ChartEngineDetector {
  /**
   * Verifies if official TradingView Advanced Charts library distribution files
   * exist in the application (e.g. window.TradingView or /charting_library/charting_library.standalone.js)
   */
  public static getEngineStatus(): ChartEngineStatus {
    const hasWindowTv = typeof window !== 'undefined' && !!(window as any).TradingView;
    const hasLibraryFiles = false; // Set to true only when authorized distribution files are present in public/

    if (hasWindowTv || hasLibraryFiles) {
      return {
        activeEngine: 'ADVANCED_CHARTS',
        advancedChartsAvailable: true,
      };
    }

    return {
      activeEngine: 'LIGHTWEIGHT_CHARTS',
      advancedChartsAvailable: false,
      missingPrerequisites: [
        'Official written approval from TradingView (https://www.tradingview.com/free-charting-libraries/)',
        'Access to official private TradingView GitHub repository (tradingview/charting_library)',
        'Library distribution files placed in public/charting_library/ (charting_library.standalone.js, etc.)',
      ],
    };
  }
}
