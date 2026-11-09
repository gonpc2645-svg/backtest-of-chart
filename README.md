# BACKTEST OF CHART

**Practice. Replay. Analyze. Improve.**  
*A Free Historical Market Backtesting Platform.*

[![Production Ready](https://img.shields.io/badge/Production%20Status-Ready%20(Audited)-success)](https://github.com/gonpc2645-svg/backtest-of-chart)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Future Leakage](https://img.shields.io/badge/Replay%20Engine-Zero%20Future%20Leakage-brightgreen)](https://github.com/gonpc2645-svg/backtest-of-chart)
[![Platform Model](https://img.shields.io/badge/Access-100%25%20Free%20%7C%20No%20Login-orange)](https://github.com/gonpc2645-svg/backtest-of-chart)

---

## Overview

**BACKTEST OF CHART** is a standalone, publicly accessible, 100% free historical market backtesting platform designed for traders to practice deterministic replay, test execution strategies, and analyze performance across verified historical market sessions.

- **No login or signup required**
- **No subscription plans or paywalls**
- **No broker connections or real-money trading**
- **Deterministic Historical Replay Engine** with strict zero-future-data-leakage protection
- **Proprietary Simulated Trading Engine** with realistic market/pending orders, margin checks, hedging, and stop-outs
- **Comprehensive Analytics Engine** computing win rate, expectancy, profit factor, max drawdown, streaks, and periodic reports
- **Official TradingView Advanced Charts Adapter Ready** with seamless Lightweight Charts fallback

---

## System Architecture (Phases 1–7)

| Module | Operational Status | Key Capabilities |
|---|---|---|
| **Phase 1: Foundation & Brand Identity** | Active | Responsive dark-theme UI, marketing homepage, and interactive backtest configuration wizard. |
| **Phase 2: Historical Market Data Engine** | Active | SQLite WAL database storing 1,383 instruments and 3,063 verified M1 candles; Dukascopy canonical catalog with Bid price basis. |
| **Phase 3: Proprietary Historical Replay Engine** | Active | Replay clock, variable speeds (0.5x–10x), step forward/backward, and deterministic higher timeframe aggregation. |
| **Phase 4: Simulated Trading Engine** | Active | Market/Limit/Stop orders, simultaneous hedging, SL/TP management, margin tracking, and 50% margin stop-out protection. |
| **Phase 5: Analytics & Reporting Engine** | Active | Trade logs, equity/drawdown curves, streak analysis, R-multiples, and CSV/JSON performance exports. |
| **Phase 6: TradingView Advanced Charts Adapter** | Active Fallback | Full datafeed implementation supporting 7 timeframes; Lightweight Charts active pending official library license. |
| **Phase 7: Security & Production QA** | Active | CSP headers, rate limiting, ingestion guard (HTTP 403), and 63/63 master production audit checks passed. |

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TradingView Lightweight Charts 5.2
- **Backend:** Node.js, Express 5, TypeScript (`tsx`)
- **Database:** SQLite (WAL mode, persistent single-file database)
- **State & Storage:** Deterministic in-memory stores with IndexedDB / LocalStorage persistence
- **Styling:** Modular CSS design tokens (zero heavy CSS framework bloat)

---

## Quick Start & Local Development

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+ recommended)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/gonpc2645-svg/backtest-of-chart.git
cd backtest-of-chart
npm install
```

### 2. Run Backend API Server
The Express API runs on `http://localhost:3001`:
```bash
npm run server
```

### 3. Run Frontend Development Server
In a second terminal, start Vite on `http://localhost:5173`:
```bash
npm run dev
```

### 4. Build for Production
To type-check and generate optimized production chunks:
```bash
npm run build
```

---

## Automated Verification & Audit Suites

Run any of the deterministic test suites:

```bash
# Phase 7 Master Production Audit (63/63 checks)
npx tsx server/src/scripts/audit_phase7_production.ts

# Phase 6 TradingView Readiness & Licensing Gate
npx tsx server/src/scripts/audit_phase6_readiness.ts

# Phase 4 Simulated Trading Engine Verification (48/48 unit tests)
npx tsx server/src/scripts/test_trading_engine.ts

# Phase 5 Analytics & Performance Reporting Verification (52/52 tests)
npx tsx server/src/scripts/test_analytics_engine.ts

# Phase 3 Replay Engine & Cursor Invariants (12/12 tests)
npx tsx server/src/scripts/test_replay_engine.ts
```

---

## Disclaimer

**BACKTEST OF CHART** is strictly an educational and analytical tool for historical market replay and strategy backtesting. It does not provide financial advice, broker execution, or real-money trading capabilities. Market data is sourced for historical analysis purposes only.

---

## License

This project is open-source and free for public use under the [MIT License](LICENSE).
