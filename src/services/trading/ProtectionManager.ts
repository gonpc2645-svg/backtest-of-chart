import { ApiCandle } from '../marketDataApi';
import { Position } from './TradingTypes';

export interface ProtectionTriggerResult {
  position: Position;
  exitPrice: number;
  reason: 'SL' | 'TP';
  isAmbiguous: boolean;
  notes: string;
}

export class ProtectionManager {
  /**
   * Evaluates all open positions against a newly completed historical M1 candle.
   * Enforces:
   * 1. Conservative SL-first rule on same-candle ambiguity.
   * 2. Actual market opening price execution on gaps beyond Stop Loss.
   */
  public static evaluateProtections(
    positions: Position[],
    m1: ApiCandle
  ): ProtectionTriggerResult[] {
    const results: ProtectionTriggerResult[] = [];

    for (const pos of positions) {
      if (pos.status !== 'OPEN') continue;

      let slTriggered = false;
      let tpTriggered = false;

      // Check conditions
      if (pos.direction === 'BUY') {
        if (pos.stopLoss !== undefined && pos.stopLoss !== null && pos.stopLoss > 0) {
          if (m1.low <= pos.stopLoss) {
            slTriggered = true;
          }
        }
        if (pos.takeProfit !== undefined && pos.takeProfit !== null && pos.takeProfit > 0) {
          if (m1.high >= pos.takeProfit) {
            tpTriggered = true;
          }
        }
      } else {
        // Short position
        if (pos.stopLoss !== undefined && pos.stopLoss !== null && pos.stopLoss > 0) {
          if (m1.high >= pos.stopLoss) {
            slTriggered = true;
          }
        }
        if (pos.takeProfit !== undefined && pos.takeProfit !== null && pos.takeProfit > 0) {
          if (m1.low <= pos.takeProfit) {
            tpTriggered = true;
          }
        }
      }

      // 1. Same-Candle Ambiguity: Conservative SL-first rule
      if (slTriggered && tpTriggered) {
        const exitPrice = this.computeSLExitPrice(pos, m1);
        results.push({
          position: pos,
          exitPrice,
          reason: 'SL',
          isAmbiguous: true,
          notes: 'Both SL and TP touched within single M1 candle. Executed conservative SL-first rule.',
        });
        continue;
      }

      // 2. Stop Loss execution
      if (slTriggered) {
        const exitPrice = this.computeSLExitPrice(pos, m1);
        const gapped =
          pos.direction === 'BUY'
            ? m1.open < pos.stopLoss!
            : m1.open > pos.stopLoss!;

        results.push({
          position: pos,
          exitPrice,
          reason: 'SL',
          isAmbiguous: false,
          notes: gapped
            ? `Stop Loss executed at candle open (${exitPrice}) due to historical market gap.`
            : `Stop Loss executed at requested level (${pos.stopLoss}).`,
        });
        continue;
      }

      // 3. Take Profit execution
      if (tpTriggered) {
        const exitPrice = this.computeTPExitPrice(pos, m1);
        results.push({
          position: pos,
          exitPrice,
          reason: 'TP',
          isAmbiguous: false,
          notes: `Take Profit executed at ${exitPrice}.`,
        });
      }
    }

    return results;
  }

  /**
   * Computes SL exit price taking into account historical price gaps.
   */
  private static computeSLExitPrice(pos: Position, m1: ApiCandle): number {
    const sl = pos.stopLoss!;
    if (pos.direction === 'BUY') {
      // If candle opened lower than SL, fill at candle open (gap adverse)
      if (m1.open < sl) return m1.open;
      return sl;
    } else {
      // If candle opened higher than SL, fill at candle open (gap adverse)
      if (m1.open > sl) return m1.open;
      return sl;
    }
  }

  /**
   * Computes TP exit price taking into account favorable price gaps.
   */
  private static computeTPExitPrice(pos: Position, m1: ApiCandle): number {
    const tp = pos.takeProfit!;
    if (pos.direction === 'BUY') {
      // If opened above TP, take favorable open price
      if (m1.open > tp) return m1.open;
      return tp;
    } else {
      // If opened below TP, take favorable open price
      if (m1.open < tp) return m1.open;
      return tp;
    }
  }
}
