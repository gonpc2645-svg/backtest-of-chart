import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ReplayChartAdapter } from './ReplayChartAdapter';

export type DrawingToolType =
  | 'CURSOR'
  | 'TRENDLINE'
  | 'HLINE'
  | 'RECTANGLE'
  | 'FIBONACCI'
  | 'LONG_RR'
  | 'SHORT_RR';

export interface ChartDrawing {
  id: string;
  type: Exclude<DrawingToolType, 'CURSOR'>;
  t1: number;
  p1: number;
  t2: number;
  p2: number;
  p3?: number; // For LONG_RR / SHORT_RR: p1 = entry, p2 = stopLoss, p3 = takeProfit
  color: string;
  label?: string;
}

interface ChartDrawingOverlayProps {
  sessionId: string;
  adapter: ReplayChartAdapter | null;
  currentTimeSec: number;
  currentPrice: number;
  onApplyPositionTool?: (params: {
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  }) => void;
}

const FIB_LEVELS = [
  { level: 0, label: '0.0%', color: '#94a3b8' },
  { level: 0.382, label: '38.2%', color: '#38bdf8' },
  { level: 0.5, label: '50.0%', color: '#eab308' },
  { level: 0.618, label: '61.8% (OTE)', color: '#22c55e' },
  { level: 0.786, label: '78.6%', color: '#a855f7' },
  { level: 1, label: '100.0%', color: '#94a3b8' },
];

export const ChartDrawingOverlay: React.FC<ChartDrawingOverlayProps> = ({
  sessionId,
  adapter,
  currentTimeSec,
  currentPrice,
  onApplyPositionTool,
}) => {
  const [activeTool, setActiveTool] = useState<DrawingToolType>('CURSOR');
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [draftPoint, setDraftPoint] = useState<{ t: number; p: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [, setRenderTick] = useState<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const storageKey = `boc_drawings_${sessionId}`;

  // Load saved drawings for session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setDrawings(JSON.parse(raw));
      } else {
        setDrawings([]);
      }
    } catch {
      setDrawings([]);
    }
  }, [storageKey]);

  const saveDrawings = useCallback(
    (next: ChartDrawing[]) => {
      setDrawings(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [storageKey]
  );

  // Re-render SVG coordinates whenever chart scrolls/zooms/updates
  useEffect(() => {
    if (!adapter) return;
    return adapter.subscribeVisualChange(() => {
      setRenderTick((t) => t + 1);
    });
  }, [adapter]);

  const formatPrice = (p: number) => {
    if (!p || isNaN(p)) return '0.00';
    return p < 10 ? p.toFixed(5) : p < 200 ? p.toFixed(3) : p.toFixed(2);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'CURSOR' || !adapter || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPrice = adapter.coordinateToPrice(y) ?? currentPrice;
    const clickedTime = adapter.coordinateToTime(x) ?? currentTimeSec;

    if (!clickedPrice) return;

    // Single-click tools: HLINE, LONG_RR, SHORT_RR
    if (activeTool === 'HLINE') {
      const newDrawing: ChartDrawing = {
        id: 'drw_' + Date.now(),
        type: 'HLINE',
        t1: clickedTime,
        p1: clickedPrice,
        t2: clickedTime + 3600,
        p2: clickedPrice,
        color: '#38bdf8',
      };
      saveDrawings([...drawings, newDrawing]);
      setActiveTool('CURSOR');
      return;
    }

    if (activeTool === 'LONG_RR' || activeTool === 'SHORT_RR') {
      const isLong = activeTool === 'LONG_RR';
      const offset = clickedPrice * 0.0035; // 0.35% default SL distance
      const sl = isLong ? clickedPrice - offset : clickedPrice + offset;
      const tp = isLong ? clickedPrice + offset * 2.5 : clickedPrice - offset * 2.5;

      const newDrawing: ChartDrawing = {
        id: 'drw_' + Date.now(),
        type: activeTool,
        t1: clickedTime,
        p1: clickedPrice,
        t2: clickedTime + 15 * 60 * 18,
        p2: sl,
        p3: tp,
        color: isLong ? '#22c55e' : '#ef4444',
      };
      saveDrawings([...drawings, newDrawing]);
      setActiveTool('CURSOR');

      if (onApplyPositionTool) {
        onApplyPositionTool({
          direction: isLong ? 'BUY' : 'SELL',
          entryPrice: Number(formatPrice(clickedPrice)),
          stopLoss: Number(formatPrice(sl)),
          takeProfit: Number(formatPrice(tp)),
        });
      }
      return;
    }

    // Two-click tools: TRENDLINE, RECTANGLE, FIBONACCI
    if (!draftPoint) {
      setDraftPoint({ t: clickedTime, p: clickedPrice });
    } else {
      const newDrawing: ChartDrawing = {
        id: 'drw_' + Date.now(),
        type: activeTool,
        t1: draftPoint.t,
        p1: draftPoint.p,
        t2: clickedTime,
        p2: clickedPrice,
        color:
          activeTool === 'TRENDLINE'
            ? '#22d3ee'
            : activeTool === 'RECTANGLE'
            ? '#a855f7'
            : '#eab308',
      };
      saveDrawings([...drawings, newDrawing]);
      setDraftPoint(null);
      setActiveTool('CURSOR');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draftPoint || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleUndo = () => {
    if (drawings.length === 0) return;
    saveDrawings(drawings.slice(0, -1));
  };

  const handleClearAll = () => {
    saveDrawings([]);
    setDraftPoint(null);
  };

  const isInteractive = activeTool !== 'CURSOR';

  return (
    <>
      {/* Left Vertical TradingView-style Drawing Toolbar */}
      <div className="replay-drawing-toolbar" role="toolbar" aria-label="Chart Drawing Tools">
        <button
          type="button"
          className={`replay-draw-btn ${activeTool === 'CURSOR' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('CURSOR');
            setDraftPoint(null);
          }}
          title="Crosshair / Cursor"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
        </button>

        <button
          type="button"
          className={`replay-draw-btn ${activeTool === 'TRENDLINE' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('TRENDLINE');
            setDraftPoint(null);
          }}
          title="Trendline (Click 2 points)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="20" x2="20" y2="4" />
            <circle cx="4" cy="20" r="2" />
            <circle cx="20" cy="4" r="2" />
          </svg>
        </button>

        <button
          type="button"
          className={`replay-draw-btn ${activeTool === 'HLINE' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('HLINE');
            setDraftPoint(null);
          }}
          title="Horizontal Key Level / Ray"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>

        <button
          type="button"
          className={`replay-draw-btn ${activeTool === 'RECTANGLE' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('RECTANGLE');
            setDraftPoint(null);
          }}
          title="Supply / Demand / FVG Zone Box (Click 2 corners)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
          </svg>
        </button>

        <button
          type="button"
          className={`replay-draw-btn ${activeTool === 'FIBONACCI' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('FIBONACCI');
            setDraftPoint(null);
          }}
          title="Fibonacci Retracement (Swing Low to High)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="5" x2="21" y2="5" />
            <line x1="3" y1="10" x2="21" y2="10" strokeDasharray="2 2" />
            <line x1="3" y1="15" x2="21" y2="15" strokeDasharray="2 2" />
            <line x1="3" y1="20" x2="21" y2="20" />
          </svg>
        </button>

        <div className="replay-draw-divider" />

        <button
          type="button"
          className={`replay-draw-btn replay-draw-btn--long ${activeTool === 'LONG_RR' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('LONG_RR');
            setDraftPoint(null);
          }}
          title="Long Position R:R Box (Auto-fills Order SL/TP)"
        >
          <span style={{ fontSize: '0.66rem', fontWeight: 800 }}>L R:R</span>
        </button>

        <button
          type="button"
          className={`replay-draw-btn replay-draw-btn--short ${activeTool === 'SHORT_RR' ? 'replay-draw-btn--active' : ''}`}
          onClick={() => {
            setActiveTool('SHORT_RR');
            setDraftPoint(null);
          }}
          title="Short Position R:R Box (Auto-fills Order SL/TP)"
        >
          <span style={{ fontSize: '0.66rem', fontWeight: 800 }}>S R:R</span>
        </button>

        <div className="replay-draw-divider" />

        <button
          type="button"
          className="replay-draw-btn"
          onClick={handleUndo}
          disabled={drawings.length === 0}
          title="Undo Last Drawing"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>

        <button
          type="button"
          className="replay-draw-btn"
          onClick={handleClearAll}
          disabled={drawings.length === 0}
          title="Clear All Drawings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      {/* Tool Instruction Banner */}
      {isInteractive && (
        <div className="replay-draw-banner">
          <span>
            Tool Active: <strong>{activeTool}</strong> &mdash;{' '}
            {activeTool === 'HLINE' || activeTool === 'LONG_RR' || activeTool === 'SHORT_RR'
              ? 'Click on chart to place'
              : draftPoint
              ? 'Click second point on chart to finish'
              : 'Click first anchor point on chart'}
          </span>
          <button type="button" onClick={() => setActiveTool('CURSOR')}>
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* SVG Drawing Layer */}
      <svg
        ref={svgRef}
        className="replay-drawing-svg"
        style={{
          pointerEvents: isInteractive ? 'auto' : 'none',
          cursor: isInteractive ? 'crosshair' : 'default',
        }}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
      >
        {/* Render Saved Drawings */}
        {adapter &&
          drawings.map((d) => {
            const x1 = adapter.timeToCoordinate(d.t1) ?? 80;
            const y1 = adapter.priceToCoordinate(d.p1);
            const x2 = adapter.timeToCoordinate(d.t2) ?? x1 + 160;
            const y2 = adapter.priceToCoordinate(d.p2);

            if (y1 === null || y2 === null) return null;

            if (d.type === 'HLINE') {
              return (
                <g key={d.id}>
                  <line
                    x1={0}
                    y1={y1}
                    x2="100%"
                    y2={y1}
                    stroke={d.color}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <rect x={60} y={y1 - 18} width={96} height={16} rx={3} fill="#0f172a" stroke={d.color} strokeWidth={0.8} />
                  <text x={66} y={y1 - 7} fill="#e2e8f0" fontSize="10" fontWeight="600">
                    Key: {formatPrice(d.p1)}
                  </text>
                </g>
              );
            }

            if (d.type === 'TRENDLINE') {
              return (
                <g key={d.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d.color} strokeWidth={2} />
                  <circle cx={x1} cy={y1} r={3.5} fill={d.color} />
                  <circle cx={x2} cy={y2} r={3.5} fill={d.color} />
                </g>
              );
            }

            if (d.type === 'RECTANGLE') {
              const rx = Math.min(x1, x2);
              const ry = Math.min(y1, y2);
              const rw = Math.max(20, Math.abs(x2 - x1));
              const rh = Math.max(6, Math.abs(y2 - y1));
              return (
                <g key={d.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill="rgba(168, 85, 247, 0.16)"
                    stroke="#a855f7"
                    strokeWidth={1.3}
                  />
                  <text x={rx + 6} y={ry + 13} fill="#d8b4fe" fontSize="10" fontWeight="600">
                    Zone / FVG ({formatPrice(Math.max(d.p1, d.p2))} - {formatPrice(Math.min(d.p1, d.p2))})
                  </text>
                </g>
              );
            }

            if (d.type === 'FIBONACCI') {
              const rx = Math.min(x1, x2);
              const rw = Math.max(140, Math.abs(x2 - x1));
              const diffP = d.p2 - d.p1;
              return (
                <g key={d.id}>
                  {FIB_LEVELS.map((fl) => {
                    const lvlPrice = d.p2 - diffP * fl.level;
                    const ly = adapter.priceToCoordinate(lvlPrice);
                    if (ly === null) return null;
                    return (
                      <g key={fl.level}>
                        <line
                          x1={rx}
                          y1={ly}
                          x2={rx + rw}
                          y2={ly}
                          stroke={fl.color}
                          strokeWidth={fl.level === 0.618 ? 1.6 : 1}
                          strokeDasharray={fl.level === 0 || fl.level === 1 ? undefined : '4 3'}
                        />
                        <text x={rx + 4} y={ly - 3} fill={fl.color} fontSize="9.5" fontWeight="600">
                          {fl.label} ({formatPrice(lvlPrice)})
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            }

            if (d.type === 'LONG_RR' || d.type === 'SHORT_RR') {
              const yTp = d.p3 ? adapter.priceToCoordinate(d.p3) : null;
              if (yTp === null) return null;
              const rx = x1;
              const rw = 165;
              const riskAbs = Math.abs(d.p1 - d.p2);
              const rewardAbs = Math.abs((d.p3 || d.p1) - d.p1);
              const rr = riskAbs > 0 ? (rewardAbs / riskAbs).toFixed(2) : '2.50';

              const tpTop = Math.min(y1, yTp);
              const tpH = Math.max(4, Math.abs(yTp - y1));
              const slTop = Math.min(y1, y2);
              const slH = Math.max(4, Math.abs(y2 - y1));

              return (
                <g key={d.id}>
                  {/* Profit Box */}
                  <rect
                    x={rx}
                    y={tpTop}
                    width={rw}
                    height={tpH}
                    fill="rgba(34, 197, 94, 0.18)"
                    stroke="#22c55e"
                    strokeWidth={1.2}
                  />
                  {/* Stop Loss Box */}
                  <rect
                    x={rx}
                    y={slTop}
                    width={rw}
                    height={slH}
                    fill="rgba(239, 68, 68, 0.2)"
                    stroke="#ef4444"
                    strokeWidth={1.2}
                  />
                  {/* Entry Line */}
                  <line x1={rx} y1={y1} x2={rx + rw} y2={y1} stroke="#e2e8f0" strokeWidth={1.8} />
                  {/* Label */}
                  <rect x={rx + 4} y={y1 - 18} width={156} height={16} rx={3} fill="#0f172a" stroke="#38bdf8" strokeWidth={0.8} />
                  <text x={rx + 10} y={y1 - 7} fill="#38bdf8" fontSize="10" fontWeight="700">
                    {d.type === 'LONG_RR' ? 'LONG' : 'SHORT'} R:R 1:{rr} @ {formatPrice(d.p1)}
                  </text>
                </g>
              );
            }

            return null;
          })}

        {/* Draft Preview while drawing 2-point shapes */}
        {adapter && draftPoint && mousePos && (
          <line
            x1={adapter.timeToCoordinate(draftPoint.t) ?? mousePos.x}
            y1={adapter.priceToCoordinate(draftPoint.p) ?? mousePos.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </svg>
    </>
  );
};
