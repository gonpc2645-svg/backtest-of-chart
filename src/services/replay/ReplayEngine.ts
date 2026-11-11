import {
  ReplayCandleData,
  ReplayDataGap,
  ReplayDataProvenance,
  ReplayEventListenerMap,
  ReplaySession,
  ReplaySpeed,
  ReplayState,
  TimeframeId,
} from './types';
import { ApiCandle } from '../marketDataApi';
import { ReplayTimeline } from './ReplayTimeline';
import { ReplayClock } from './ReplayClock';
import { ReplayCandleProcessor } from './ReplayCandleProcessor';
import { ReplayPersistence } from './ReplayPersistence';

export class ReplayEngine {
  private session: ReplaySession;
  private state: ReplayState = 'IDLE';
  private timeline: ReplayTimeline | null = null;
  private clock: ReplayClock;
  private currentBars: ReplayCandleData[] = [];
  private currentGap: ReplayDataGap | null = null;
  private provenance: ReplayDataProvenance | null = null;

  // Event listeners
  private listeners: {
    [K in keyof ReplayEventListenerMap]?: Set<ReplayEventListenerMap[K]>;
  } = {};

  constructor(session: ReplaySession) {
    this.session = { ...session, status: 'IDLE' };
    this.clock = new ReplayClock(session.speed || 1);
  }

  // ==========================================
  // EVENT SUBSCRIPTION
  // ==========================================
  public on<K extends keyof ReplayEventListenerMap>(event: K, listener: ReplayEventListenerMap[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<ReplayEventListenerMap[K]>).add(listener);
  }

  public off<K extends keyof ReplayEventListenerMap>(event: K, listener: ReplayEventListenerMap[K]): void {
    if (this.listeners[event]) {
      (this.listeners[event] as Set<ReplayEventListenerMap[K]>).delete(listener);
    }
  }

  private emit<K extends keyof ReplayEventListenerMap>(
    event: K,
    ...args: Parameters<ReplayEventListenerMap[K]>
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          (handler as any)(...args);
        } catch (err) {
          console.error(`[ReplayEngine] Error in listener for event "${event}":`, err);
        }
      }
    }
  }

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  public getState(): ReplayState {
    return this.state;
  }

  public getSession(): ReplaySession {
    return { ...this.session, status: this.state };
  }

  public getCurrentBars(): ReplayCandleData[] {
    return [...this.currentBars];
  }

  public getCurrentGap(): ReplayDataGap | null {
    return this.currentGap;
  }

  public getCursor(): number {
    return this.session.cursor;
  }

  public getSpeed(): ReplaySpeed {
    return this.clock.getSpeed();
  }

  public getTimeframe(): TimeframeId {
    return this.session.timeframe;
  }

  public getCurrentCandle(): ApiCandle | null {
    return this.timeline?.getCurrentCandle() || null;
  }

  public getProvenance(): ReplayDataProvenance | null {
    return this.provenance;
  }

  private setState(newState: ReplayState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.session.status = newState;
    this.emit('stateChange', newState);
    this.persist();
  }

  private persist(): void {
    ReplayPersistence.saveSession({
      ...this.session,
      status: 'PAUSED', // Always persistent as PAUSED for safe resume
      updatedAt: Date.now(),
    }).catch((err) => console.warn('[ReplayEngine] Persistence failed:', err));
  }

  // ==========================================
  // INITIALIZATION & RESTORATION
  // ==========================================
  public async initialize(): Promise<void> {
    this.setState('INITIALIZING');
    try {
      // Compute context lookback in ms cleanly across weekend closures (at least 72h for non-crypto intraday)
      const tfMinutes =
        this.session.timeframe === 'D1'
          ? 1440
          : this.session.timeframe === 'H4'
          ? 240
          : this.session.timeframe === 'H1'
          ? 60
          : this.session.timeframe === 'M30'
          ? 30
          : this.session.timeframe === 'M15'
          ? 15
          : this.session.timeframe === 'M5'
          ? 5
          : 1;

      const rawContextMs = 60 * tfMinutes * 60 * 1000;
      const maxReasonableLookbackMs =
        this.session.timeframe === 'D1' ? 30 * 86400000 : this.session.timeframe === 'H4' ? 10 * 86400000 : 5 * 86400000;
      const minMarketLookbackMs = this.session.provider === 'DUKASCOPY' ? 72 * 3600000 : 24 * 3600000;
      const contextLookbackMs = Math.max(minMarketLookbackMs, Math.min(rawContextMs, maxReasonableLookbackMs));
      const contextStartTs = Math.max(0, this.session.startTimestamp - contextLookbackMs);

      // 1. Setup timeline
      this.timeline = new ReplayTimeline(
        this.session.instrumentId,
        this.session.startTimestamp,
        this.session.endTimestamp,
        this.session.cursor || this.session.startTimestamp
      );

      // 2. Load genuine historical candles from contextStartTs to endTimestamp
      await this.timeline.loadRange(contextStartTs, this.session.endTimestamp);

      this.provenance = this.timeline.getProvenance();
      if (this.provenance) {
        this.emit('provenanceUpdate', this.provenance);
      }

      // 3. Reconstruct chart bars up to current cursor (STRICT ZERO FUTURE LEAKAGE)
      let revealedM1 = this.timeline.getRevealedCandles();
      if (revealedM1.length === 0 && this.timeline.getCandleCount() > 0) {
        const firstValidTs = this.timeline.getCandleTimestampAt(0);
        if (firstValidTs) {
          this.timeline.setCursor(firstValidTs);
          this.session.cursor = this.timeline.getCursor();
          revealedM1 = this.timeline.getRevealedCandles();
        }
      }

      if (!this.timeline.hasCandlesInPlaybackWindow()) {
        const fromStr = new Date(this.session.startTimestamp).toISOString().slice(0, 10);
        const toStr = new Date(this.session.endTimestamp).toISOString().slice(0, 10);
        throw new Error(
          `No genuine market candles found for ${this.session.providerSymbol} between ${fromStr} and ${toStr} UTC. Markets may be closed (weekend/holiday) or in the future — please choose an active trading date.`
        );
      }

      this.currentBars = ReplayCandleProcessor.reconstructBarsUpToCursor(
        revealedM1,
        this.session.timeframe,
        this.session.cursor
      );

      this.setState('PAUSED');
      this.emit('cursorChange', this.session.cursor, this.timeline.getProgressPct());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ReplayEngine] Initialization failed:', msg);
      this.setState('ERROR');
      this.emit('error', msg);
      throw err;
    }
  }

  // ==========================================
  // PLAYBACK CONTROLS
  // ==========================================
  public play(): void {
    if (this.state === 'PLAYING') return;
    if (this.state === 'DATA_GAP') {
      console.warn('[ReplayEngine] Cannot play while in DATA_GAP state. Acknowledge gap first.');
      return;
    }
    if (this.state === 'COMPLETED') {
      console.warn('[ReplayEngine] Replay is already completed.');
      return;
    }
    if (!this.timeline) {
      console.warn('[ReplayEngine] Timeline not initialized.');
      return;
    }

    this.setState('PLAYING');
    this.clock.start(async () => {
      return this.executeTick();
    });
  }

  public pause(): void {
    if (this.state !== 'PLAYING') return;
    this.clock.stop();
    this.setState('PAUSED');
  }

  public setSpeed(speed: ReplaySpeed): void {
    this.session.speed = speed;
    this.clock.setSpeed(speed);
    this.emit('speedChange', speed);
    this.persist();
  }

  public setTimeframe(newTimeframe: TimeframeId): void {
    if (this.session.timeframe === newTimeframe) return;
    this.session.timeframe = newTimeframe;

    // Full deterministic reconstruction of visible bars for new timeframe up to cursor
    if (this.timeline) {
      const revealedM1 = this.timeline.getRevealedCandles();
      this.currentBars = ReplayCandleProcessor.reconstructBarsUpToCursor(
        revealedM1,
        newTimeframe,
        this.session.cursor
      );
    }

    this.emit('timeframeChange', newTimeframe);
    this.persist();
  }

  /**
   * Advances by exactly 1 M1 candle.
   * If not currently playing, operates in step-forward mode.
   */
  public async stepForward(): Promise<boolean> {
    if (this.state === 'PLAYING') {
      this.pause();
    }
    return this.executeTick();
  }

  /**
   * Reverts back by 1 M1 candle.
   * Strictly recalculates history up to new cursor to prevent any future memory retention.
   */
  public stepBackward(): boolean {
    if (this.state === 'PLAYING') {
      this.pause();
    }
    if (!this.timeline) return false;

    const prevCursor = this.timeline.stepBackward();
    if (prevCursor === null) {
      return false; // Already at the start
    }

    this.session.cursor = prevCursor;

    // Deterministic reconstruction: discard any memory of bars after new cursor
    const revealedM1 = this.timeline.getRevealedCandles();
    this.currentBars = ReplayCandleProcessor.reconstructBarsUpToCursor(
      revealedM1,
      this.session.timeframe,
      prevCursor
    );

    this.emit('cursorChange', prevCursor, this.timeline.getProgressPct());
    this.persist();
    return true;
  }

  /**
   * Resets replay position to the original startTimestamp.
   */
  public reset(): void {
    this.pause();
    if (!this.timeline) return;

    this.session.cursor = this.session.startTimestamp;
    this.timeline.setCursor(this.session.startTimestamp);

    const revealedM1 = this.timeline.getRevealedCandles();
    this.currentBars = ReplayCandleProcessor.reconstructBarsUpToCursor(
      revealedM1,
      this.session.timeframe,
      this.session.startTimestamp
    );

    this.setState('PAUSED');
    this.emit('cursorChange', this.session.cursor, this.timeline.getProgressPct());
    this.persist();
  }

  /**
   * User explicitly acknowledges a detected data gap and resumes progression across it.
   */
  public continueAcrossGap(): void {
    if (this.state !== 'DATA_GAP' || !this.currentGap) return;

    // Record skipped gap
    if (!this.session.skippedGaps) {
      this.session.skippedGaps = [];
    }
    this.session.skippedGaps.push(this.currentGap);

    this.currentGap = null;
    this.setState('PAUSED');

    // Reveal the next candle across the gap
    this.executeTick(true);
  }

  /**
   * Directly seeks to a timeline position (e.g. from user scrub bar).
   */
  public seek(targetTimestampMs: number): void {
    if (!this.timeline) return;
    this.pause();

    this.timeline.seekTo(targetTimestampMs);
    this.session.cursor = this.timeline.getCursor();

    const revealedM1 = this.timeline.getRevealedCandles();
    this.currentBars = ReplayCandleProcessor.reconstructBarsUpToCursor(
      revealedM1,
      this.session.timeframe,
      this.session.cursor
    );

    this.emit('cursorChange', this.session.cursor, this.timeline.getProgressPct());
    this.persist();
  }

  // ==========================================
  // TICK ENGINE
  // ==========================================
  private async executeTick(ignoreGap: boolean = false): Promise<boolean> {
    if (!this.timeline) return false;

    // Check for completion
    if (this.timeline.isAtEnd()) {
      this.clock.stop();
      this.setState('COMPLETED');
      return false;
    }

    // Pause only on severe unexpected M1 data outages (ignore normal rollovers, holidays, weekends, and non-1m fallbacks)
    const isCanonical1m = !this.provenance || this.provenance.resolution === '1m';
    const maxSilentGapMinutes = this.session.provider === 'DUKASCOPY' ? 96 * 60 : 6 * 60;
    if (!ignoreGap && isCanonical1m) {
      const gapCheck = this.timeline.peekGap();
      if (gapCheck && gapCheck.gap && gapCheck.gap.missingMinutes > maxSilentGapMinutes) {
        this.clock.stop();
        this.currentGap = gapCheck.gap;
        this.setState('DATA_GAP');
        this.emit('gapDetected', gapCheck.gap);
        return false;
      }
    }

    // Advance to next M1 candle
    const nextM1 = this.timeline.advanceNext();
    if (!nextM1) {
      this.clock.stop();
      this.setState('COMPLETED');
      return false;
    }

    this.session.cursor = nextM1.timestamp;

    // Incrementally process new M1 into current higher-timeframe bar
    const procResult = ReplayCandleProcessor.processIncrementalM1(
      nextM1,
      this.session.timeframe,
      this.currentBars
    );

    this.currentBars = procResult.updatedBars;

    // Notify listeners of the forming or new bar and canonical M1 candle
    this.emit('candleUpdate', procResult.activeBar, procResult.isNewBar);
    this.emit('m1Candle', nextM1);
    this.emit('cursorChange', this.session.cursor, this.timeline.getProgressPct());

    // Check if end reached
    if (this.timeline.isAtEnd()) {
      this.clock.stop();
      this.setState('COMPLETED');
      return false;
    }

    return true;
  }

  public dispose(): void {
    this.clock.stop();
    this.listeners = {};
    this.currentBars = [];
    this.timeline = null;
  }
}
