import { TradingEvent, TradingEventType } from './TradingTypes';

export class TradingEventLedger {
  private events: TradingEvent[] = [];

  constructor(initialEvents: TradingEvent[] = []) {
    this.events = [...initialEvents];
  }

  public record(
    sessionId: string,
    type: TradingEventType,
    timestamp: number,
    details: Record<string, any>,
    balanceAfter: number,
    equityAfter: number
  ): TradingEvent {
    const event: TradingEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      sessionId,
      type,
      timestamp,
      details,
      balanceAfter: Number(balanceAfter.toFixed(2)),
      equityAfter: Number(equityAfter.toFixed(2)),
    };

    this.events.push(event);
    return event;
  }

  public getEvents(): TradingEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }
}
