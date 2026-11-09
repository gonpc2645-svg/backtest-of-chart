import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
} from 'lightweight-charts';
import { ReplayCandleData } from '../../services/replay/types';
import { Order, Position } from '../../services/trading/TradingTypes';

export interface LegendOHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  changePct?: number;
}

export class ReplayChartAdapter {
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onLegendUpdate?: (data: LegendOHLC | null) => void;
  private lastCandle: ReplayCandleData | null = null;
  private tradePriceLines: IPriceLine[] = [];

  public initialize(
    container: HTMLElement,
    onLegend?: (data: LegendOHLC | null) => void
  ): void {
    this.dispose();
    this.onLegendUpdate = onLegend;

    this.chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#070A10' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(27, 37, 55, 0.6)' },
        horzLines: { color: 'rgba(27, 37, 55, 0.6)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(56, 189, 248, 0.5)',
          width: 1,
          style: 2, // LineStyle.Dashed
          labelBackgroundColor: '#0F172A',
        },
        horzLine: {
          color: 'rgba(56, 189, 248, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0F172A',
        },
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1E293B',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Add Candlestick series
    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#22D3EE',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#22D3EE',
      wickDownColor: '#F43F5E',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Add Volume histogram series
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      color: 'rgba(34, 211, 238, 0.3)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay pane
    });

    this.volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    // Crosshair move subscriber for OHLC legend
    this.chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !this.candleSeries) {
        if (this.onLegendUpdate && this.lastCandle) {
          this.onLegendUpdate(this.formatLegend(this.lastCandle));
        }
        return;
      }

      const bar = param.seriesData.get(this.candleSeries) as any;
      if (bar && this.onLegendUpdate) {
        const volBar = this.volumeSeries ? (param.seriesData.get(this.volumeSeries) as any) : null;
        this.onLegendUpdate({
          time: Number(bar.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: volBar?.value,
          changePct: bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0,
        });
      }
    });

    // Auto-resize on container size change
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0 || !this.chart) return;
        const entry = entries[0];
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0 && height > 0) {
          this.chart.applyOptions({ width, height });
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  public setCandles(candles: ReplayCandleData[]): void {
    if (!this.candleSeries) return;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    this.candleSeries.setData(formattedCandles);

    if (this.volumeSeries) {
      const formattedVolumes = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(34, 211, 238, 0.35)' : 'rgba(244, 63, 94, 0.35)',
      }));
      this.volumeSeries.setData(formattedVolumes);
    }

    if (candles.length > 0) {
      this.lastCandle = candles[candles.length - 1];
      if (this.onLegendUpdate) {
        this.onLegendUpdate(this.formatLegend(this.lastCandle));
      }
    }

    this.chart?.timeScale().scrollToRealTime();
  }

  public updateCandle(candle: ReplayCandleData): void {
    if (!this.candleSeries) return;

    this.candleSeries.update({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });

    if (this.volumeSeries) {
      this.volumeSeries.update({
        time: candle.time as UTCTimestamp,
        value: candle.volume ?? 0,
        color: candle.close >= candle.open ? 'rgba(34, 211, 238, 0.35)' : 'rgba(244, 63, 94, 0.35)',
      });
    }

    this.lastCandle = candle;
    if (this.onLegendUpdate) {
      this.onLegendUpdate(this.formatLegend(candle));
    }
  }

  public fitContent(): void {
    this.chart?.timeScale().fitContent();
  }

  public scrollToRealTime(): void {
    this.chart?.timeScale().scrollToRealTime();
  }

  private formatLegend(c: ReplayCandleData): LegendOHLC {
    return {
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      changePct: c.open ? ((c.close - c.open) / c.open) * 100 : 0,
    };
  }

  public updateTradeOverlays(positions: Position[], pendingOrders: Order[]): void {
    if (!this.candleSeries) return;

    // Clear previous lines
    for (const line of this.tradePriceLines) {
      try {
        this.candleSeries.removePriceLine(line);
      } catch {
        // Line might already be cleared
      }
    }
    this.tradePriceLines = [];

    // Draw active positions
    for (const pos of positions) {
      if (pos.status !== 'OPEN') continue;

      // Entry Price Line
      const entryLine = this.candleSeries.createPriceLine({
        price: pos.entryPrice,
        color: pos.direction === 'BUY' ? '#22d3ee' : '#f43f5e',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${pos.direction} #${pos.id.slice(-4)} (${pos.quantity})`,
      });
      this.tradePriceLines.push(entryLine);

      // Stop Loss Line
      if (pos.stopLoss) {
        const slLine = this.candleSeries.createPriceLine({
          price: pos.stopLoss,
          color: '#f87171',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL #${pos.id.slice(-4)}`,
        });
        this.tradePriceLines.push(slLine);
      }

      // Take Profit Line
      if (pos.takeProfit) {
        const tpLine = this.candleSeries.createPriceLine({
          price: pos.takeProfit,
          color: '#4ade80',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP #${pos.id.slice(-4)}`,
        });
        this.tradePriceLines.push(tpLine);
      }
    }

    // Draw active pending orders
    for (const ord of pendingOrders) {
      if (ord.status !== 'PENDING') continue;
      const ordLine = this.candleSeries.createPriceLine({
        price: ord.requestedPrice,
        color: '#fbbf24',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${ord.orderType} ${ord.direction} (${ord.quantity})`,
      });
      this.tradePriceLines.push(ordLine);
    }
  }

  public dispose(): void {
    if (this.candleSeries) {
      for (const line of this.tradePriceLines) {
        try {
          this.candleSeries.removePriceLine(line);
        } catch {
          // ignore
        }
      }
    }
    this.tradePriceLines = [];

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
    this.candleSeries = null;
    this.volumeSeries = null;
    this.lastCandle = null;
  }
}
