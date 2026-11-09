export type OrderDirection = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type PositionCloseReason = 'MANUAL' | 'PARTIAL' | 'SL' | 'TP' | 'STOP_OUT';
export type PriceModel = 'LAST_PRICE' | 'BID_ASK' | 'SPREAD_ASSUMPTION';

export interface ExecutionAssumptions {
  priceModel: PriceModel;
  spreadPipsOrPts: number;
  commissionPerLotOrUnit: number;
  slippagePoints: number;
  swapLong: number;
  swapShort: number;
}

export interface InstrumentSpecification {
  instrumentId: string;
  provider: 'BINANCE' | 'DUKASCOPY';
  baseAsset: string;
  quoteAsset: string;
  marketCategory: 'crypto' | 'forex' | 'metals' | 'indices';
  contractSize: number;       // Units per lot: 1 for crypto, 100,000 for FX, 100 for Gold
  minQuantity: number;        // Minimum allowed trade size
  maxQuantity?: number;       // Maximum allowed trade size
  quantityStep: number;       // Precision step (e.g. 0.001 BTC, 0.01 lot)
  tickSize: number;           // Minimum price movement (e.g. 0.01, 0.00001)
  pricePrecision: number;     // Decimals in price display
  volumePrecision: number;    // Decimals in quantity display
  marginRequirement: number;  // Margin fraction requirement (e.g. 0.01 for 1:100 leverage)
  priceBasis: 'LAST' | 'BID' | 'ASK';
  tradingSupported: boolean;
  unsupportedReason?: string;
}

export interface Order {
  id: string;
  sessionId: string;
  instrumentId: string;
  direction: OrderDirection;
  orderType: OrderType;
  quantity: number;
  requestedPrice: number;     // Target price for Limit/Stop, or current permitted price for Market
  stopLoss?: number;
  takeProfit?: number;
  status: OrderStatus;
  createdAt: number;          // UTC Unix timestamp ms
  filledAt?: number;
  filledPrice?: number;
  cancelledAt?: number;
  rejectionReason?: string;
  executionAssumptions: ExecutionAssumptions;
}

export interface Position {
  id: string;
  orderId: string;
  sessionId: string;
  instrumentId: string;
  direction: OrderDirection;
  quantity: number;           // Current remaining quantity
  initialQuantity: number;    // Original opened quantity
  entryPrice: number;
  entryTimestamp: number;     // UTC Unix ms
  currentPrice: number;       // Latest permitted valuation price
  stopLoss?: number;
  takeProfit?: number;
  status: PositionStatus;
  realizedPnL: number;        // Realized P/L from partial closes
  unrealizedPnL: number;      // Floating P/L based on current price
  usedMargin: number;         // Reserved margin in USD
  closePrice?: number;
  closeTimestamp?: number;
  closeReason?: PositionCloseReason;
  executionAssumptions: ExecutionAssumptions;
  isAmbiguous?: boolean;      // True if SL and TP were touched in the same M1 candle
  executionNotes?: string;
}

export interface TradingAccount {
  currency: 'USD';
  initialBalance: number;
  balance: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number | null; // (Equity / UsedMargin) * 100, or null if no open positions
  stopOutLevel: number;       // Threshold (default 50%)
  leverage: number;           // e.g. 100 for 1:100
  realizedPnL: number;
  unrealizedPnL: number;
  tradingMode: 'HEDGING';     // Independent simultaneous Long & Short positions
  isLocked: boolean;          // Locked once first order is placed to prevent recalculation invalidation
}

export type TradingEventType =
  | 'ORDER_CREATED'
  | 'ORDER_REJECTED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'ORDER_MODIFIED'
  | 'POSITION_OPENED'
  | 'POSITION_MODIFIED'
  | 'POSITION_PARTIALLY_CLOSED'
  | 'POSITION_CLOSED'
  | 'SL_TRIGGERED'
  | 'TP_TRIGGERED'
  | 'MARGIN_WARNING'
  | 'STOP_OUT'
  | 'ACCOUNT_RESET';

export interface TradingEvent {
  id: string;
  sessionId: string;
  type: TradingEventType;
  timestamp: number;          // Current simulation UTC Unix ms
  details: Record<string, any>;
  balanceAfter: number;
  equityAfter: number;
}

export interface TradeRecord {
  id: string;
  positionId: string;
  orderId: string;
  instrumentId: string;
  direction: OrderDirection;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;          // UTC Unix ms
  exitTime: number;           // UTC Unix ms
  pnl: number;
  exitReason: PositionCloseReason;
  isAmbiguous?: boolean;
}

export interface CreateOrderRequest {
  direction: OrderDirection;
  orderType: OrderType;
  quantity: number;
  requestedPrice?: number;    // Required for LIMIT and STOP orders
  stopLoss?: number;
  takeProfit?: number;
  executionAssumptions?: Partial<ExecutionAssumptions>;
}

export interface TradingState {
  account: TradingAccount;
  positions: Position[];      // Open positions
  closedPositions: Position[]; // Closed historical positions
  pendingOrders: Order[];     // Active pending orders
  completedOrders: Order[];   // Historical filled, cancelled, or rejected orders
  tradeRecords: TradeRecord[];// Closed trade records for table & CSV
  events: TradingEvent[];     // Immutable event ledger
  executionAssumptions: ExecutionAssumptions;
  updatedAt: number;
}

export interface TradingEventListenerMap {
  stateChange: (state: TradingState) => void;
  orderCreated: (order: Order) => void;
  orderFilled: (order: Order, position: Position) => void;
  orderRejected: (order: Order, reason: string) => void;
  positionClosed: (position: Position, trade: TradeRecord) => void;
  stopOut: (closedPositions: Position[], marginLevel: number) => void;
}
