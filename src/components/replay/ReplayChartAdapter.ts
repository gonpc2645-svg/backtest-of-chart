import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
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
  ema20?: number;
  ema50?: number;
}

export class ReplayChartAdapter {
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private ema20Series: ISeriesApi<'Line'> | null = null;
  private ema50Series: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onLegendUpdate?: (data: LegendOHLC | null) => void;
  private onChartPriceClick?: (price: number, time: number) => void;
  private visualChangeListeners = new Set<() => void>();
  private lastCandle: ReplayCandleData | null = null;
  private allCandles: ReplayCandleData[] = [];
  private tradePriceLines: IPriceLine[] = [];
  private showEma: boolean = true;

  public initialize(
    container: HTMLElement,
    onLegend?: (data: LegendOHLC | null) => void,
    onPriceClick?: (price: number, time: number) => void
  ): void {
    this.dispose();
    this.onLegendUpdate = onLegend;
    this.onChartPriceClick = onPriceClick;

    this.chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#05141F' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(46, 230, 242, 0.06)' },
        horzLines: { color: 'rgba(46, 230, 242, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(46, 230, 242, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#022E4A',
        },
        horzLine: {
          color: 'rgba(46, 230, 242, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#022E4A',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
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

    // Add EMA 20 & EMA 50 Line series
    this.ema20Series = this.chart.addSeries(LineSeries, {
      color: '#38BDF8',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    this.ema50Series = this.chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Add Volume histogram series
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      color: 'rgba(34, 211, 238, 0.3)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
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
        const e20 = this.ema20Series ? (param.seriesData.get(this.ema20Series) as any) : null;
        const e50 = this.ema50Series ? (param.seriesData.get(this.ema50Series) as any) : null;
        this.onLegendUpdate({
          time: Number(bar.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: volBar?.value,
          changePct: bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0,
          ema20: e20?.value,
          ema50: e50?.value,
        });
      }
    });

    // Click handler for interactive price picking & drawing tools
    this.chart.subscribeClick((param) => {
      if (!param || !param.point || !this.candleSeries) return;
      const price = this.candleSeries.coordinateToPrice(param.point.y);
      const time = param.time ? Number(param.time) : this.lastCandle?.time || 0;
      if (price !== null && this.onChartPriceClick) {
        this.onChartPriceClick(Number(price), time);
      }
    });

    // Notify overlay when timeScale scrolls/zooms
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.notifyVisualChange();
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
          this.notifyVisualChange();
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  public setOnPriceClick(cb?: (price: number, time: number) => void): void {
    this.onChartPriceClick = cb;
  }

  public setTheme(mode: 'dark' | 'light'): void {
    if (!this.chart || !this.candleSeries) return;
    if (mode === 'light') {
      this.chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: '#F9F9F9' },
          textColor: '#1E293B',
        },
        grid: {
          vertLines: { color: 'rgba(15, 23, 42, 0.06)' },
          horzLines: { color: 'rgba(15, 23, 42, 0.06)' },
        },
        rightPriceScale: { borderColor: '#CBD5E1' },
        timeScale: { borderColor: '#CBD5E1' },
        crosshair: {
          vertLine: { color: 'rgba(10, 163, 212, 0.6)', labelBackgroundColor: '#02324F' },
          horzLine: { color: 'rgba(10, 163, 212, 0.6)', labelBackgroundColor: '#02324F' },
        },
      });
      this.candleSeries.applyOptions({
        upColor: '#0AA3D4',
        downColor: '#E11D48',
        wickUpColor: '#0AA3D4',
        wickDownColor: '#E11D48',
      });
    } else {
      this.chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: '#05141F' },
          textColor: '#94A3B8',
        },
        grid: {
          vertLines: { color: 'rgba(46, 230, 242, 0.06)' },
          horzLines: { color: 'rgba(46, 230, 242, 0.06)' },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.12)' },
        timeScale: { borderColor: 'rgba(255, 255, 255, 0.12)' },
        crosshair: {
          vertLine: { color: 'rgba(46, 230, 242, 0.5)', labelBackgroundColor: '#022E4A' },
          horzLine: { color: 'rgba(46, 230, 242, 0.5)', labelBackgroundColor: '#022E4A' },
        },
      });
      this.candleSeries.applyOptions({
        upColor: '#22D3EE',
        downColor: '#F43F5E',
        wickUpColor: '#22D3EE',
        wickDownColor: '#F43F5E',
      });
    }
  }

  public subscribeVisualChange(cb: () => void): () => void {
    this.visualChangeListeners.add(cb);
    return () => this.visualChangeListeners.delete(cb);
  }

  private notifyVisualChange(): void {
    for (const cb of this.visualChangeListeners) {
      try {
        cb();
      } catch {
        // ignore
      }
    }
  }

  public priceToCoordinate(price: number): number | null {
    if (!this.candleSeries) return null;
    const y = this.candleSeries.priceToCoordinate(price);
    return y !== null ? Number(y) : null;
  }

  public coordinateToPrice(y: number): number | null {
    if (!this.candleSeries) return null;
    const p = this.candleSeries.coordinateToPrice(y);
    return p !== null ? Number(p) : null;
  }

  public timeToCoordinate(timeSec: number): number | null {
    if (!this.chart) return null;
    const x = this.chart.timeScale().timeToCoordinate(timeSec as UTCTimestamp);
    if (x !== null) return Number(x);
    if (this.allCandles.length > 0) {
      let nearest = this.allCandles[0];
      let minDiff = Math.abs(nearest.time - timeSec);
      for (const c of this.allCandles) {
        const diff = Math.abs(c.time - timeSec);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = c;
        }
      }
      const nx = this.chart.timeScale().timeToCoordinate(nearest.time as UTCTimestamp);
      return nx !== null ? Number(nx) : null;
    }
    return null;
  }

  public coordinateToTime(x: number): number | null {
    if (!this.chart) return null;
    const t = this.chart.timeScale().coordinateToTime(x);
    if (t !== null) return Number(t);
    return this.lastCandle?.time || null;
  }

  public setEmaVisible(visible: boolean): void {
    this.showEma = visible;
    this.ema20Series?.applyOptions({ visible });
    this.ema50Series?.applyOptions({ visible });
  }

  private computeEmaSeries(candles: ReplayCandleData[], period: number): Array<{ time: UTCTimestamp; value: number }> {
    if (candles.length === 0) return [];
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    const out: Array<{ time: UTCTimestamp; value: number }> = [];
    for (let i = 0; i < candles.length; i++) {
      ema = i === 0 ? candles[i].close : candles[i].close * k + ema * (1 - k);
      out.push({ time: candles[i].time as UTCTimestamp, value: ema });
    }
    return out;
  }

  private refreshIndicators(): void {
    if (!this.ema20Series || !this.ema50Series) return;
    if (!this.showEma || this.allCandles.length === 0) {
      this.ema20Series.setData([]);
      this.ema50Series.setData([]);
      return;
    }
    this.ema20Series.setData(this.computeEmaSeries(this.allCandles, 20));
    this.ema50Series.setData(this.computeEmaSeries(this.allCandles, 50));
  }

  public setCandles(candles: ReplayCandleData[]): void {
    if (!this.candleSeries) return;
    this.allCandles = [...candles];

    // Detect precision automatically from price magnitude
    if (candles.length > 0) {
      const samplePrice = candles[candles.length - 1].close;
      const isForexFourDec = samplePrice > 0 && samplePrice < 10;
      this.candleSeries.applyOptions({
        priceFormat: {
          type: 'price',
          precision: isForexFourDec ? 5 : samplePrice < 200 ? 3 : 2,
          minMove: isForexFourDec ? 0.00001 : samplePrice < 200 ? 0.001 : 0.01,
        },
      });
    }

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    this.candleSeries.setData(formattedCandles);
    this.refreshIndicators();

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
    this.notifyVisualChange();
  }

  public updateCandle(candle: ReplayCandleData): void {
    if (!this.candleSeries) return;

    const existingIdx = this.allCandles.findIndex((c) => c.time === candle.time);
    if (existingIdx >= 0) {
      this.allCandles[existingIdx] = candle;
    } else {
      this.allCandles.push(candle);
    }

    this.candleSeries.update({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });

    this.refreshIndicators();

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
    this.notifyVisualChange();
  }

  public fitContent(): void {
    this.chart?.timeScale().fitContent();
    this.notifyVisualChange();
  }

  public scrollToRealTime(): void {
    this.chart?.timeScale().scrollToRealTime();
    this.notifyVisualChange();
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

      const entryLine = this.candleSeries.createPriceLine({
        price: pos.entryPrice,
        color: pos.direction === 'BUY' ? '#22d3ee' : '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${pos.direction} #${pos.id.slice(-4)} (${pos.quantity})`,
      });
      this.tradePriceLines.push(entryLine);

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
    this.visualChangeListeners.clear();

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
    this.ema20Series = null;
    this.ema50Series = null;
    this.lastCandle = null;
    this.allCandles = [];
  }
}
