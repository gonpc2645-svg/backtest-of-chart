import { ReplaySpeed } from './types';

export class ReplayClock {
  private speed: ReplaySpeed = 1;
  private isRunning: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private onTickCallback: (() => Promise<boolean>) | null = null;
  private isTickInProgress: boolean = false;

  private static readonly SPEED_INTERVALS_MS: Record<ReplaySpeed, number> = {
    0.5: 2000,
    1: 1000,
    2: 500,
    5: 200,
    10: 100,
    20: 50,
  };

  constructor(initialSpeed: ReplaySpeed = 1) {
    this.speed = initialSpeed;
  }

  public getSpeed(): ReplaySpeed {
    return this.speed;
  }

  public setSpeed(speed: ReplaySpeed): void {
    if (this.speed === speed) return;
    this.speed = speed;

    // If currently running, reschedule timer cleanly without resetting cursor or overlapping
    if (this.isRunning && this.onTickCallback) {
      this.clearTimer();
      this.scheduleNextTick();
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public start(onTick: () => Promise<boolean>): void {
    if (this.isRunning) return; // Guard against multiple simultaneous playback loops
    this.isRunning = true;
    this.onTickCallback = onTick;
    this.scheduleNextTick();
  }

  public stop(): void {
    this.isRunning = false;
    this.clearTimer();
    this.onTickCallback = null;
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    const intervalMs = ReplayClock.SPEED_INTERVALS_MS[this.speed] || 1000;

    this.timerId = setTimeout(async () => {
      if (!this.isRunning || this.isTickInProgress) return;

      this.isTickInProgress = true;
      try {
        if (this.onTickCallback) {
          const shouldContinue = await this.onTickCallback();
          if (shouldContinue && this.isRunning) {
            this.scheduleNextTick();
          } else {
            this.stop();
          }
        }
      } catch (err) {
        console.error('[ReplayClock] Error during tick execution:', err);
        this.stop();
      } finally {
        this.isTickInProgress = false;
      }
    }, intervalMs);
  }
}
