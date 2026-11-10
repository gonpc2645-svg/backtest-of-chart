import React, { useEffect, useRef, useState } from 'react';

export interface ReviewableTrade {
  id: string;
  instrumentId: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  entryTime: number;
  exitTime: number;
  exitReason: string;
}

export interface TradeJournalMetadata {
  tradeId: string;
  setupTag: string;
  moodTag: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  notes: string;
  updatedAt: number;
}

const SETUP_TAGS = [
  'SMC / Orderblock',
  'Fair Value Gap (FVG)',
  'Liquidity Sweep + BOS',
  'London / NY Breakout',
  'Trend Pullback (EMA)',
  'Support / Resistance',
];

const MOOD_TAGS = [
  'Disciplined (Followed Plan)',
  'Patient Wait',
  'FOMO Entry',
  'Early Exit / Fear',
  'Moved Stop Loss',
  'Revenge Trade',
];

export function getStoredJournalMeta(tradeId: string): TradeJournalMetadata {
  try {
    const raw = localStorage.getItem('boc_trade_journal_meta');
    const map = raw ? JSON.parse(raw) : {};
    if (map[tradeId]) return map[tradeId];
  } catch {
    // ignore
  }
  return {
    tradeId,
    setupTag: 'SMC / Orderblock',
    moodTag: 'Disciplined (Followed Plan)',
    grade: 'A',
    notes: '',
    updatedAt: Date.now(),
  };
}

export function saveStoredJournalMeta(meta: TradeJournalMetadata): void {
  try {
    const raw = localStorage.getItem('boc_trade_journal_meta');
    const map = raw ? JSON.parse(raw) : {};
    map[meta.tradeId] = { ...meta, updatedAt: Date.now() };
    localStorage.setItem('boc_trade_journal_meta', JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function detectTradingSession(ts: number): 'London' | 'New York' | 'London/NY Overlap' | 'Tokyo / Asian' {
  const hr = new Date(ts).getUTCHours();
  if (hr >= 12 && hr < 16) return 'London/NY Overlap';
  if (hr >= 7 && hr < 16) return 'London';
  if (hr >= 16 && hr < 21) return 'New York';
  return 'Tokyo / Asian';
}

interface TradeExecutionReviewModalProps {
  trade: ReviewableTrade | null;
  onClose: () => void;
  onMetaSaved?: (meta: TradeJournalMetadata) => void;
}

export const TradeExecutionReviewModal: React.FC<TradeExecutionReviewModalProps> = ({
  trade,
  onClose,
  onMetaSaved,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [setupTag, setSetupTag] = useState<string>('SMC / Orderblock');
  const [moodTag, setMoodTag] = useState<string>('Disciplined (Followed Plan)');
  const [grade, setGrade] = useState<'A+' | 'A' | 'B' | 'C' | 'F'>('A');
  const [notes, setNotes] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    if (!trade) return;
    const existing = getStoredJournalMeta(trade.id);
    setSetupTag(existing.setupTag);
    setMoodTag(existing.moodTag);
    setGrade(existing.grade);
    setNotes(existing.notes);
    setSavedNotice(false);
  }, [trade]);

  // Draw SNRBD APK style AdvancedTradeChart on HTML5 Canvas
  useEffect(() => {
    if (!trade || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 280;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear Background
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, width, height);

    const isBuy = trade.direction === 'BUY';
    const isWin = trade.pnl >= 0;
    const entry = trade.entryPrice;
    const exit = trade.exitPrice;
    const priceDiff = Math.abs(exit - entry) || entry * 0.0025;
    const inferredSl =
      trade.stopLoss || (isBuy ? entry - priceDiff * 0.65 : entry + priceDiff * 0.65);
    const inferredTp =
      trade.takeProfit || (isBuy ? entry + priceDiff * 1.3 : entry - priceDiff * 1.3);

    const allPrices = [entry, exit, inferredSl, inferredTp];
    const minP = Math.min(...allPrices) - priceDiff * 0.45;
    const maxP = Math.max(...allPrices) + priceDiff * 0.45;
    const rangeP = Math.max(0.00001, maxP - minP);

    const padTop = 28;
    const padBottom = 26;
    const padLeft = 18;
    const padRight = 96;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const priceToY = (p: number) => padTop + ((maxP - p) / rangeP) * chartH;

    // Subtle Grid Lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
    }

    // Draw Risk / Reward Shaded Zones between Entry, SL, and Exit/TP
    const yEntry = priceToY(entry);
    const ySl = priceToY(inferredSl);
    const yExit = priceToY(exit);

    const entryIdx = 8;
    const exitIdx = 22;
    const totalBars = 28;
    const stepX = chartW / totalBars;
    const xEntry = padLeft + entryIdx * stepX;
    const xExit = padLeft + exitIdx * stepX;

    // SL Zone Fill
    ctx.fillStyle = 'rgba(239, 68, 68, 0.10)';
    ctx.fillRect(xEntry, Math.min(yEntry, ySl), xExit - xEntry, Math.abs(ySl - yEntry));

    // Execution Outcome Zone Fill
    ctx.fillStyle = isWin ? 'rgba(34, 197, 94, 0.12)' : 'rgba(244, 63, 94, 0.12)';
    ctx.fillRect(xEntry, Math.min(yEntry, yExit), xExit - xEntry, Math.abs(yExit - yEntry));

    // Generate deterministic synthetic candlesticks (PRICE ACTION) matching the trade trajectory
    let seed = trade.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 17);
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const startPrice = isBuy ? entry - priceDiff * 0.25 : entry + priceDiff * 0.25;
    let curClose = startPrice;

    for (let i = 0; i < totalBars; i++) {
      const cx = padLeft + i * stepX + stepX * 0.5;
      let targetP: number;
      if (i <= entryIdx) {
        const t = i / entryIdx;
        targetP = startPrice + (entry - startPrice) * t;
      } else if (i <= exitIdx) {
        const t = (i - entryIdx) / (exitIdx - entryIdx);
        const wave = Math.sin(t * Math.PI * 2) * priceDiff * 0.14;
        targetP = entry + (exit - entry) * t + wave;
      } else {
        const t = (i - exitIdx) / (totalBars - exitIdx);
        targetP = exit + (isWin ? (isBuy ? 1 : -1) : isBuy ? -1 : 1) * priceDiff * 0.12 * t;
      }

      const open = i === entryIdx ? entry : curClose;
      const close = i === exitIdx ? exit : targetP + (rand() - 0.5) * priceDiff * 0.12;
      const high = Math.max(open, close) + rand() * priceDiff * 0.18;
      const low = Math.min(open, close) - rand() * priceDiff * 0.18;
      curClose = close;

      const isBull = close >= open;
      const color = isBull ? '#22d3ee' : '#f43f5e';

      const yO = priceToY(open);
      const yC = priceToY(close);
      const yH = priceToY(high);
      const yL = priceToY(low);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, yH);
      ctx.lineTo(cx, yL);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(2.5, Math.abs(yC - yO));
      ctx.fillStyle = color;
      ctx.fillRect(cx - stepX * 0.28, bodyTop, stepX * 0.56, bodyH);
    }

    // Draw Horizontal Level Lines: SL, ENTRY, EXIT/TP
    const decimals = entry < 10 ? 5 : entry < 200 ? 3 : 2;
    const drawLevelLine = (price: number, label: string, color: string, dashed: boolean) => {
      const y = priceToY(price);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.setLineDash(dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Right Axis Tag
      ctx.fillStyle = color;
      ctx.fillRect(width - padRight + 4, y - 9, padRight - 8, 18);
      ctx.fillStyle = '#070B14';
      ctx.font = 'bold 9.5px Inter, monospace';
      ctx.fillText(`${label} ${price.toFixed(decimals)}`, width - padRight + 8, y + 3.5);
    };

    drawLevelLine(inferredSl, 'SL', '#f87171', true);
    drawLevelLine(entry, 'ENTRY', '#38bdf8', false);
    drawLevelLine(exit, isWin ? 'TP/EXIT' : 'EXIT', isWin ? '#4ade80' : '#fb7185', true);

    // Entry & Exit Execution Markers
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(xEntry + stepX * 0.5, yEntry, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isWin ? '#4ade80' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(xExit + stepX * 0.5, yExit, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }, [trade]);

  if (!trade) return null;

  const isBuy = trade.direction === 'BUY';
  const isWin = trade.pnl >= 0;
  const decimals = trade.entryPrice < 10 ? 5 : trade.entryPrice < 200 ? 3 : 2;
  const sessionName = detectTradingSession(trade.entryTime);
  const durationMin = Math.max(1, Math.round((trade.exitTime - trade.entryTime) / 60000));

  const slDist = trade.stopLoss ? Math.abs(trade.entryPrice - trade.stopLoss) : Math.abs(trade.exitPrice - trade.entryPrice) * 0.5;
  const rMultiple =
    slDist > 0
      ? ((isBuy ? trade.exitPrice - trade.entryPrice : trade.entryPrice - trade.exitPrice) / slDist).toFixed(2)
      : isWin
      ? '+2.10'
      : '-1.00';

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    const meta: TradeJournalMetadata = {
      tradeId: trade.id,
      setupTag,
      moodTag,
      grade,
      notes,
      updatedAt: Date.now(),
    };
    saveStoredJournalMeta(meta);
    setSavedNotice(true);
    if (onMetaSaved) onMetaSaved(meta);
  };

  return (
    <div className="replay-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="trade-review-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0B1120',
          border: '1px solid #1E293B',
          borderRadius: 12,
          width: '94%',
          maxWidth: 780,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 20,
          color: '#F8FAFC',
          boxShadow: '0 24px 60px rgba(0,0,0,0.75)',
        }}
      >
        {/* Header (SNRBD APK + TradeZella Style) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: isBuy ? 'rgba(34, 211, 238, 0.16)' : 'rgba(244, 63, 94, 0.16)',
                  color: isBuy ? '#22d3ee' : '#f43f5e',
                }}
              >
                {isBuy ? 'BULLISH EXECUTION ↑' : 'BEARISH EXECUTION ↓'}
              </span>
              <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                {trade.instrumentId.split(':')[1] || trade.instrumentId} &bull; #{trade.id.slice(-6)}
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                }}
              >
                {sessionName} Session
              </span>
            </div>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.1rem' }}>
              EXECUTION REVIEW &amp; TRADE JOURNAL
            </h3>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: isWin ? '#4ade80' : '#f43f5e',
              }}
            >
              {isWin ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)} ({rMultiple}R)
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-action-sm"
              style={{ marginTop: 4 }}
            >
              Close &times;
            </button>
          </div>
        </div>

        {/* Synthetic Price Action Candlestick Chart (APK AdvancedTradeChart) */}
        <div
          style={{
            background: '#070B14',
            border: '1px solid #1E293B',
            borderRadius: 8,
            padding: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: '#94A3B8',
              marginBottom: 6,
            }}
          >
            <span>PRICE ACTION EXECUTION CHART (ENTRY &rarr; EXIT / TP / SL)</span>
            <span>
              Entry: <strong style={{ color: '#38bdf8' }}>{trade.entryPrice.toFixed(decimals)}</strong> &bull; Exit:{' '}
              <strong style={{ color: isWin ? '#4ade80' : '#f43f5e' }}>{trade.exitPrice.toFixed(decimals)}</strong> &bull;
              Hold: <strong>{durationMin}m</strong>
            </span>
          </div>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 240, display: 'block', borderRadius: 6 }}
          />
        </div>

        {/* Key Execution Metrics Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: 6, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Lot / Quantity</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{trade.quantity}</div>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: 6, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Exit Condition</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isWin ? '#4ade80' : '#f87171' }}>
              {trade.exitReason}
            </div>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: 6, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Realized R:R</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#38bdf8' }}>{rMultiple} R</div>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: 6, border: '1px solid #1F2937' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Market Session</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{sessionName}</div>
          </div>
        </div>

        {/* TradeZella + SNRBD APK Strategy & Psychology Tagging Form */}
        <form onSubmit={handleSaveJournal}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                Strategy / Setup Playbook Tag
              </label>
              <select
                value={setupTag}
                onChange={(e) => setSetupTag(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  color: '#F8FAFC',
                  fontSize: '0.82rem',
                }}
              >
                {SETUP_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                Psychology / Execution Mood
              </label>
              <select
                value={moodTag}
                onChange={(e) => setMoodTag(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  color: '#F8FAFC',
                  fontSize: '0.82rem',
                }}
              >
                {MOOD_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
                Execution Grade
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['A+', 'A', 'B', 'C', 'F'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 6,
                      border: grade === g ? '1px solid #38bdf8' : '1px solid #334155',
                      background: grade === g ? 'rgba(56, 189, 248, 0.2)' : '#0F172A',
                      color: grade === g ? '#38bdf8' : '#94A3B8',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 4 }}>
              Trade Notes / Strategy Review / Lessons Learned
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your execution observations, confluence factors (HTF bias, FVG, liquidity sweep), or mistakes..."
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#F8FAFC',
                fontSize: '0.82rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {savedNotice ? (
              <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 600 }}>
                ✓ Journal tags &amp; review notes saved to trade record!
              </span>
            ) : (
              <span style={{ color: '#64748B', fontSize: '0.76rem' }}>
                Synced with Analytics &amp; Session Performance Dashboard
              </span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="btn btn--primary btn--sm">
                Save Trade Review
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
