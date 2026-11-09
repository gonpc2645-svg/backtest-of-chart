import { CreateOrderRequest, InstrumentSpecification, Position } from './TradingTypes';
import { PositionCalculator } from './PositionCalculator';

export interface OrderValidationResult {
  valid: boolean;
  error?: string;
  requiredMargin?: number;
  effectivePrice?: number;
}

export class OrderValidator {
  /**
   * Validates an order placement request before execution or queuing.
   */
  public static validateCreateOrder(
    req: CreateOrderRequest,
    spec: InstrumentSpecification,
    currentPrice: number,
    freeMargin: number,
    leverage: number
  ): OrderValidationResult {
    // 1. Instrument support check
    if (!spec.tradingSupported) {
      return {
        valid: false,
        error: spec.unsupportedReason || `Trading is not supported for ${spec.instrumentId}.`,
      };
    }

    if (currentPrice <= 0) {
      return { valid: false, error: 'Current market price is unavailable or invalid.' };
    }

    // 2. Quantity bounds & step check
    if (!req.quantity || req.quantity <= 0) {
      return { valid: false, error: 'Order quantity must be greater than zero.' };
    }

    if (req.quantity < spec.minQuantity) {
      return {
        valid: false,
        error: `Order quantity (${req.quantity}) is less than minimum allowed quantity (${spec.minQuantity}).`,
      };
    }

    if (spec.maxQuantity && req.quantity > spec.maxQuantity) {
      return {
        valid: false,
        error: `Order quantity (${req.quantity}) exceeds maximum allowed quantity (${spec.maxQuantity}).`,
      };
    }

    // Check step precision
    if (spec.quantityStep > 0) {
      const stepRemainder = Math.abs((req.quantity % spec.quantityStep));
      const stepEps = spec.quantityStep * 1e-4;
      if (stepRemainder > stepEps && Math.abs(stepRemainder - spec.quantityStep) > stepEps) {
        return {
          valid: false,
          error: `Order quantity (${req.quantity}) must be a valid multiple of step size (${spec.quantityStep}).`,
        };
      }
    }

    // 3. Determine effective entry price
    let effectivePrice = currentPrice;
    if (req.orderType === 'LIMIT' || req.orderType === 'STOP') {
      if (!req.requestedPrice || req.requestedPrice <= 0) {
        return { valid: false, error: `${req.orderType} order requires a valid positive requested price.` };
      }
      effectivePrice = req.requestedPrice;
    }

    // 4. Pending order price validation relative to current price
    if (req.orderType === 'LIMIT') {
      if (req.direction === 'BUY' && req.requestedPrice! > currentPrice) {
        return {
          valid: false,
          error: `Buy Limit price (${req.requestedPrice}) must be less than or equal to current price (${currentPrice}). Use Buy Stop instead.`,
        };
      }
      if (req.direction === 'SELL' && req.requestedPrice! < currentPrice) {
        return {
          valid: false,
          error: `Sell Limit price (${req.requestedPrice}) must be greater than or equal to current price (${currentPrice}). Use Sell Stop instead.`,
        };
      }
    }

    if (req.orderType === 'STOP') {
      if (req.direction === 'BUY' && req.requestedPrice! < currentPrice) {
        return {
          valid: false,
          error: `Buy Stop price (${req.requestedPrice}) must be greater than or equal to current price (${currentPrice}). Use Buy Limit instead.`,
        };
      }
      if (req.direction === 'SELL' && req.requestedPrice! > currentPrice) {
        return {
          valid: false,
          error: `Sell Stop price (${req.requestedPrice}) must be less than or equal to current price (${currentPrice}). Use Sell Limit instead.`,
        };
      }
    }

    // 5. Stop Loss / Take Profit bounds
    if (req.stopLoss !== undefined && req.stopLoss !== null && req.stopLoss > 0) {
      if (req.direction === 'BUY' && req.stopLoss >= effectivePrice) {
        return {
          valid: false,
          error: `Stop Loss for Long position (${req.stopLoss}) must be strictly below entry price (${effectivePrice}).`,
        };
      }
      if (req.direction === 'SELL' && req.stopLoss <= effectivePrice) {
        return {
          valid: false,
          error: `Stop Loss for Short position (${req.stopLoss}) must be strictly above entry price (${effectivePrice}).`,
        };
      }
    }

    if (req.takeProfit !== undefined && req.takeProfit !== null && req.takeProfit > 0) {
      if (req.direction === 'BUY' && req.takeProfit <= effectivePrice) {
        return {
          valid: false,
          error: `Take Profit for Long position (${req.takeProfit}) must be strictly above entry price (${effectivePrice}).`,
        };
      }
      if (req.direction === 'SELL' && req.takeProfit >= effectivePrice) {
        return {
          valid: false,
          error: `Take Profit for Short position (${req.takeProfit}) must be strictly below entry price (${effectivePrice}).`,
        };
      }
    }

    // 6. Margin requirement check
    const requiredMargin = PositionCalculator.calculateRequiredMargin(
      req.quantity,
      effectivePrice,
      leverage,
      spec.contractSize
    );

    if (requiredMargin > freeMargin) {
      return {
        valid: false,
        error: `Insufficient free margin. Required: $${requiredMargin.toFixed(2)}, Available: $${freeMargin.toFixed(2)}.`,
        requiredMargin,
        effectivePrice,
      };
    }

    return {
      valid: true,
      requiredMargin,
      effectivePrice,
    };
  }

  /**
   * Validates partial close quantity against position.
   */
  public static validatePartialClose(
    position: Position,
    quantityToClose: number,
    spec: InstrumentSpecification
  ): { valid: boolean; error?: string } {
    if (quantityToClose <= 0) {
      return { valid: false, error: 'Partial close quantity must be greater than zero.' };
    }
    if (quantityToClose >= position.quantity) {
      return { valid: false, error: `Partial close quantity (${quantityToClose}) must be less than total open quantity (${position.quantity}). Use full close instead.` };
    }
    if (quantityToClose < spec.minQuantity) {
      return { valid: false, error: `Partial close quantity (${quantityToClose}) is below minimum allowed (${spec.minQuantity}).` };
    }
    return { valid: true };
  }

  /**
   * Validates protection (SL/TP) modification.
   */
  public static validateProtectionModification(
    position: Position,
    newSL?: number,
    newTP?: number
  ): { valid: boolean; error?: string } {
    if (newSL !== undefined && newSL !== null && newSL > 0) {
      if (position.direction === 'BUY' && newSL >= position.currentPrice) {
        return { valid: false, error: `Stop Loss for Long position (${newSL}) must be below current valuation price (${position.currentPrice}).` };
      }
      if (position.direction === 'SELL' && newSL <= position.currentPrice) {
        return { valid: false, error: `Stop Loss for Short position (${newSL}) must be above current valuation price (${position.currentPrice}).` };
      }
    }

    if (newTP !== undefined && newTP !== null && newTP > 0) {
      if (position.direction === 'BUY' && newTP <= position.currentPrice) {
        return { valid: false, error: `Take Profit for Long position (${newTP}) must be above current valuation price (${position.currentPrice}).` };
      }
      if (position.direction === 'SELL' && newTP >= position.currentPrice) {
        return { valid: false, error: `Take Profit for Short position (${newTP}) must be below current valuation price (${position.currentPrice}).` };
      }
    }

    return { valid: true };
  }
}
