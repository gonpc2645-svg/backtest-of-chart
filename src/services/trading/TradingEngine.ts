import { ApiCandle, ApiMarketInstrument } from '../marketDataApi';
import { AccountManager } from './AccountManager';
import { ExecutionCostModel } from './ExecutionCostModel';
import { InstrumentSpecificationService } from './InstrumentSpecificationService';
import { OrderExecutionEngine } from './OrderExecutionEngine';
import { OrderValidator } from './OrderValidator';
import { PositionManager } from './PositionManager';
import { ProtectionManager } from './ProtectionManager';
import { TradingEventLedger } from './TradingEventLedger';
import { TradingPersistence } from './TradingPersistence';
import {
  CreateOrderRequest,
  ExecutionAssumptions,
  InstrumentSpecification,
  Order,
  Position,
  TradingAccount,
  TradingEventListenerMap,
  TradingState,
} from './TradingTypes';

export class TradingEngine {
  private sessionId: string;
  private specification: InstrumentSpecification;
  private state: TradingState;
  private ledger: TradingEventLedger;
  private listeners: {
    [K in keyof TradingEventListenerMap]?: Set<TradingEventListenerMap[K]>;
  } = {};

  constructor(
    sessionId: string,
    instrument: ApiMarketInstrument,
    initialState?: Partial<TradingState>
  ) {
    this.sessionId = sessionId;
    this.specification = InstrumentSpecificationService.getSpecification(instrument);

    const initialAccount = initialState?.account || AccountManager.createDefaultAccount(10000, 100);
    const initialEvents = initialState?.events || [];
    this.ledger = new TradingEventLedger(initialEvents);

    this.state = {
      account: initialAccount,
      positions: initialState?.positions || [],
      closedPositions: initialState?.closedPositions || [],
      pendingOrders: initialState?.pendingOrders || [],
      completedOrders: initialState?.completedOrders || [],
      tradeRecords: initialState?.tradeRecords || [],
      events: this.ledger.getEvents(),
      executionAssumptions: initialState?.executionAssumptions || ExecutionCostModel.DEFAULT_ASSUMPTIONS,
      updatedAt: Date.now(),
    };
  }

  // ==========================================
  // EVENT SUBSCRIPTION
  // ==========================================
  public on<K extends keyof TradingEventListenerMap>(
    event: K,
    listener: TradingEventListenerMap[K]
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<TradingEventListenerMap[K]>).add(listener);
  }

  public off<K extends keyof TradingEventListenerMap>(
    event: K,
    listener: TradingEventListenerMap[K]
  ): void {
    if (this.listeners[event]) {
      (this.listeners[event] as Set<TradingEventListenerMap[K]>).delete(listener);
    }
  }

  private emit<K extends keyof TradingEventListenerMap>(
    event: K,
    ...args: Parameters<TradingEventListenerMap[K]>
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          (handler as any)(...args);
        } catch (err) {
          console.error(`[TradingEngine] Listener error on event "${event}":`, err);
        }
      }
    }
  }

  // ==========================================
  // GETTERS & CONFIGURATION
  // ==========================================
  public getState(): TradingState {
    return {
      ...this.state,
      events: this.ledger.getEvents(),
    };
  }

  public getAccount(): TradingAccount {
    return { ...this.state.account };
  }

  public getPositions(): Position[] {
    return [...this.state.positions];
  }

  public getPendingOrders(): Order[] {
    return [...this.state.pendingOrders];
  }

  public getSpecification(): InstrumentSpecification {
    return { ...this.specification };
  }

  public configureAccount(params: { initialBalance?: number; leverage?: number; stopOutLevel?: number }): boolean {
    if (this.state.account.isLocked) {
      console.warn('[TradingEngine] Cannot reconfigure account settings once trading has begun.');
      return false;
    }

    const initBal = params.initialBalance ?? this.state.account.initialBalance;
    const lev = params.leverage ?? this.state.account.leverage;
    const stopOut = params.stopOutLevel ?? this.state.account.stopOutLevel;

    this.state.account = {
      ...this.state.account,
      initialBalance: initBal,
      balance: initBal,
      equity: initBal,
      freeMargin: initBal,
      leverage: lev,
      stopOutLevel: stopOut,
    };

    this.persist();
    this.emit('stateChange', this.getState());
    return true;
  }

  public setExecutionAssumptions(assumptions: Partial<ExecutionAssumptions>): void {
    this.state.executionAssumptions = {
      ...this.state.executionAssumptions,
      ...assumptions,
    };
    this.persist();
    this.emit('stateChange', this.getState());
  }

  // ==========================================
  // ORDER PLACEMENT
  // ==========================================
  public placeOrder(
    req: CreateOrderRequest,
    currentPrice: number,
    currentCursor: number
  ): { success: boolean; orderId?: string; error?: string } {
    const validation = OrderValidator.validateCreateOrder(
      req,
      this.specification,
      currentPrice,
      this.state.account.freeMargin,
      this.state.account.leverage
    );

    const assumptions: ExecutionAssumptions = {
      ...this.state.executionAssumptions,
      ...(req.executionAssumptions || {}),
    };

    const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const order: Order = {
      id: orderId,
      sessionId: this.sessionId,
      instrumentId: this.specification.instrumentId,
      direction: req.direction,
      orderType: req.orderType,
      quantity: req.quantity,
      requestedPrice: req.requestedPrice ?? currentPrice,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit,
      status: 'PENDING',
      createdAt: currentCursor,
      executionAssumptions: assumptions,
    };

    if (!validation.valid) {
      order.status = 'REJECTED';
      order.rejectionReason = validation.error;
      this.state.completedOrders.push(order);

      this.ledger.record(
        this.sessionId,
        'ORDER_REJECTED',
        currentCursor,
        { orderId, reason: validation.error, request: req },
        this.state.account.balance,
        this.state.account.equity
      );

      this.emit('orderRejected', order, validation.error || 'Validation failed');
      this.persist();
      return { success: false, error: validation.error };
    }

    // Record order created
    this.ledger.record(
      this.sessionId,
      'ORDER_CREATED',
      currentCursor,
      { orderId, request: req },
      this.state.account.balance,
      this.state.account.equity
    );
    this.emit('orderCreated', order);

    // 1. Immediate execution for MARKET orders
    if (req.orderType === 'MARKET') {
      const execResult = OrderExecutionEngine.executeMarketOrder(
        order,
        currentPrice,
        currentCursor,
        this.state.account.leverage,
        this.specification.contractSize
      );

      this.state.completedOrders.push(execResult.filledOrder);
      this.state.positions.push(execResult.position);

      // Recalculate account
      this.state.account = AccountManager.recalculate(this.state.account, this.state.positions);

      this.ledger.record(
        this.sessionId,
        'ORDER_FILLED',
        currentCursor,
        { orderId, fillPrice: execResult.filledOrder.filledPrice },
        this.state.account.balance,
        this.state.account.equity
      );

      this.ledger.record(
        this.sessionId,
        'POSITION_OPENED',
        currentCursor,
        { positionId: execResult.position.id, direction: req.direction, quantity: req.quantity, entryPrice: execResult.position.entryPrice },
        this.state.account.balance,
        this.state.account.equity
      );

      this.emit('orderFilled', execResult.filledOrder, execResult.position);
      this.emit('stateChange', this.getState());
      this.persist();
      return { success: true, orderId };
    }

    // 2. Queue for LIMIT and STOP orders
    this.state.pendingOrders.push(order);
    this.emit('stateChange', this.getState());
    this.persist();
    return { success: true, orderId };
  }

  public cancelPendingOrder(orderId: string, currentCursor: number): boolean {
    const idx = this.state.pendingOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;

    const order = this.state.pendingOrders[idx];
    const cancelledOrder: Order = {
      ...order,
      status: 'CANCELLED',
      cancelledAt: currentCursor,
    };

    this.state.pendingOrders.splice(idx, 1);
    this.state.completedOrders.push(cancelledOrder);

    this.ledger.record(
      this.sessionId,
      'ORDER_CANCELLED',
      currentCursor,
      { orderId },
      this.state.account.balance,
      this.state.account.equity
    );

    this.emit('stateChange', this.getState());
    this.persist();
    return true;
  }

  // ==========================================
  // POSITION MANAGEMENT
  // ==========================================
  public closePosition(
    positionId: string,
    currentPrice: number,
    currentCursor: number,
    quantityToClose?: number
  ): { success: boolean; error?: string } {
    const idx = this.state.positions.findIndex((p) => p.id === positionId);
    if (idx === -1) {
      return { success: false, error: `Position ${positionId} not found.` };
    }

    const pos = this.state.positions[idx];

    // Validate partial close if specified
    if (quantityToClose && quantityToClose < pos.quantity) {
      const val = OrderValidator.validatePartialClose(pos, quantityToClose, this.specification);
      if (!val.valid) return { success: false, error: val.error };
    }

    const closeRes = PositionManager.closePosition(
      pos,
      currentPrice,
      currentCursor,
      quantityToClose && quantityToClose < pos.quantity ? 'PARTIAL' : 'MANUAL',
      quantityToClose,
      this.specification.contractSize
    );

    if (closeRes.isFullClose) {
      this.state.positions.splice(idx, 1);
      this.state.closedPositions.push(closeRes.updatedPosition);
    } else {
      this.state.positions[idx] = closeRes.updatedPosition;
    }

    this.state.tradeRecords.push(closeRes.tradeRecord);

    // Apply realized PnL to balance
    this.state.account = AccountManager.applyRealizedTrade(this.state.account, closeRes.realizedPnL);
    this.state.account = AccountManager.recalculate(this.state.account, this.state.positions);

    const eventType = closeRes.isFullClose ? 'POSITION_CLOSED' : 'POSITION_PARTIALLY_CLOSED';
    this.ledger.record(
      this.sessionId,
      eventType,
      currentCursor,
      {
        positionId,
        exitPrice: closeRes.tradeRecord.exitPrice,
        closedQuantity: closeRes.tradeRecord.quantity,
        realizedPnL: closeRes.realizedPnL,
        reason: closeRes.tradeRecord.exitReason,
      },
      this.state.account.balance,
      this.state.account.equity
    );

    this.emit('positionClosed', closeRes.updatedPosition, closeRes.tradeRecord);
    this.emit('stateChange', this.getState());
    this.persist();
    return { success: true };
  }

  public modifyPositionProtection(
    positionId: string,
    currentCursor: number,
    stopLoss?: number,
    takeProfit?: number
  ): { success: boolean; error?: string } {
    const pos = this.state.positions.find((p) => p.id === positionId);
    if (!pos) return { success: false, error: 'Position not found' };

    const val = OrderValidator.validateProtectionModification(pos, stopLoss, takeProfit);
    if (!val.valid) return { success: false, error: val.error };

    pos.stopLoss = stopLoss && stopLoss > 0 ? stopLoss : undefined;
    pos.takeProfit = takeProfit && takeProfit > 0 ? takeProfit : undefined;

    this.ledger.record(
      this.sessionId,
      'POSITION_MODIFIED',
      currentCursor,
      { positionId, stopLoss, takeProfit },
      this.state.account.balance,
      this.state.account.equity
    );

    this.emit('stateChange', this.getState());
    this.persist();
    return { success: true };
  }

  // ==========================================
  // INTRABAR HISTORICAL M1 TICK EXECUTION
  // ==========================================
  public onTick(m1Candle: ApiCandle): void {
    if (!m1Candle) return;

    // STEP 1: Process eligible pending orders
    const pendingRes = OrderExecutionEngine.evaluatePendingOrders(
      this.state.pendingOrders,
      m1Candle,
      this.state.account.freeMargin,
      this.state.account.leverage,
      this.specification.contractSize
    );

    // Apply fills
    for (const fill of pendingRes.triggeredFills) {
      // Remove from pending
      const pIdx = this.state.pendingOrders.findIndex((o) => o.id === fill.order.id);
      if (pIdx !== -1) this.state.pendingOrders.splice(pIdx, 1);

      this.state.completedOrders.push(fill.order);
      this.state.positions.push(fill.position);

      this.ledger.record(
        this.sessionId,
        'ORDER_FILLED',
        m1Candle.timestamp,
        { orderId: fill.order.id, fillPrice: fill.order.filledPrice },
        this.state.account.balance,
        this.state.account.equity
      );
      this.ledger.record(
        this.sessionId,
        'POSITION_OPENED',
        m1Candle.timestamp,
        { positionId: fill.position.id, entryPrice: fill.position.entryPrice, quantity: fill.position.quantity },
        this.state.account.balance,
        this.state.account.equity
      );
      this.emit('orderFilled', fill.order, fill.position);
    }

    // Apply rejections
    for (const rej of pendingRes.rejectedOrders) {
      const pIdx = this.state.pendingOrders.findIndex((o) => o.id === rej.order.id);
      if (pIdx !== -1) this.state.pendingOrders.splice(pIdx, 1);
      this.state.completedOrders.push(rej.order);

      this.ledger.record(
        this.sessionId,
        'ORDER_REJECTED',
        m1Candle.timestamp,
        { orderId: rej.order.id, reason: rej.reason },
        this.state.account.balance,
        this.state.account.equity
      );
      this.emit('orderRejected', rej.order, rej.reason);
    }

    // STEP 2: Process existing position protections (SL / TP)
    const protectionResults = ProtectionManager.evaluateProtections(
      this.state.positions,
      m1Candle
    );

    for (const prot of protectionResults) {
      const pIdx = this.state.positions.findIndex((p) => p.id === prot.position.id);
      if (pIdx === -1) continue;

      const pos = this.state.positions[pIdx];
      pos.isAmbiguous = prot.isAmbiguous;

      const closeRes = PositionManager.closePosition(
        pos,
        prot.exitPrice,
        m1Candle.timestamp,
        prot.reason,
        undefined,
        this.specification.contractSize
      );

      this.state.positions.splice(pIdx, 1);
      this.state.closedPositions.push(closeRes.updatedPosition);
      this.state.tradeRecords.push(closeRes.tradeRecord);

      this.state.account = AccountManager.applyRealizedTrade(this.state.account, closeRes.realizedPnL);

      const eventType = prot.reason === 'SL' ? 'SL_TRIGGERED' : 'TP_TRIGGERED';
      this.ledger.record(
        this.sessionId,
        eventType,
        m1Candle.timestamp,
        {
          positionId: pos.id,
          exitPrice: prot.exitPrice,
          realizedPnL: closeRes.realizedPnL,
          isAmbiguous: prot.isAmbiguous,
          notes: prot.notes,
        },
        this.state.account.balance,
        this.state.account.equity
      );

      this.emit('positionClosed', closeRes.updatedPosition, closeRes.tradeRecord);
    }

    // STEP 3: Update position valuations at current M1 close
    this.state.positions = PositionManager.revaluePositions(
      this.state.positions,
      m1Candle.close,
      this.specification.contractSize
    );

    // STEP 4: Recalculate account equity and margins
    this.state.account = AccountManager.recalculate(this.state.account, this.state.positions);

    // STEP 5: Check Stop-Out threshold
    const stopOutCheck = AccountManager.evaluateStopOut(this.state.account, this.state.positions);
    if (stopOutCheck.triggered) {
      for (const posToClose of stopOutCheck.positionsToLiquidate) {
        const pIdx = this.state.positions.findIndex((p) => p.id === posToClose.id);
        if (pIdx === -1) continue;

        const closeRes = PositionManager.closePosition(
          posToClose,
          m1Candle.close,
          m1Candle.timestamp,
          'STOP_OUT',
          undefined,
          this.specification.contractSize
        );

        this.state.positions.splice(pIdx, 1);
        this.state.closedPositions.push(closeRes.updatedPosition);
        this.state.tradeRecords.push(closeRes.tradeRecord);

        this.state.account = AccountManager.applyRealizedTrade(this.state.account, closeRes.realizedPnL);

        this.ledger.record(
          this.sessionId,
          'STOP_OUT',
          m1Candle.timestamp,
          {
            positionId: posToClose.id,
            exitPrice: m1Candle.close,
            realizedPnL: closeRes.realizedPnL,
            marginLevel: stopOutCheck.currentMarginLevel,
          },
          this.state.account.balance,
          this.state.account.equity
        );
        this.emit('positionClosed', closeRes.updatedPosition, closeRes.tradeRecord);
      }

      this.state.account = AccountManager.recalculate(this.state.account, this.state.positions);
      this.emit('stopOut', stopOutCheck.positionsToLiquidate, stopOutCheck.currentMarginLevel);
    }

    this.state.updatedAt = Date.now();
    this.emit('stateChange', this.getState());
    this.persist();
  }

  // ==========================================
  // RESET ACCOUNT
  // ==========================================
  public resetAccount(
    initialBalance: number = 10000,
    leverage: number = 100,
    currentCursor: number = Date.now()
  ): void {
    this.state.account = AccountManager.createDefaultAccount(initialBalance, leverage);
    this.state.positions = [];
    this.state.closedPositions = [];
    this.state.pendingOrders = [];
    this.state.completedOrders = [];
    this.state.tradeRecords = [];
    this.ledger.clear();

    this.ledger.record(
      this.sessionId,
      'ACCOUNT_RESET',
      currentCursor,
      { initialBalance, leverage },
      initialBalance,
      initialBalance
    );

    this.persist();
    this.emit('stateChange', this.getState());
  }

  private persist(): void {
    TradingPersistence.saveTradingState(this.sessionId, this.getState()).catch((err) => {
      console.warn('[TradingEngine] Persistence failed:', err);
    });
  }

  public dispose(): void {
    this.listeners = {};
    this.state.positions = [];
  }
}
