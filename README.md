# BACKTEST OF CHART

**Practice. Replay. Analyze. Improve.**  
*A Free Historical Market Backtesting Platform.*

---

## Project Overview (Phase 1: Website Foundation)

**BACKTEST OF CHART** is a standalone, publicly accessible, completely free historical market backtesting platform.

Phase 1 delivers the independent website foundation, brand identity, design system, complete informational homepage, starter legal/contact pages, and the interactive **Backtest Setup UI** (`/backtest`).

### Phase 1 Scope
- **Homepage (`/`)**:
  - Navigation Bar (`Home`, `About`, `Features`, `Supported Markets`, `How It Works`, `FAQ`, `Start Backtest` CTA — no login, signup, account, or pricing buttons)
  - Hero Section (`MASTER YOUR TRADING THROUGH HISTORICAL BACKTESTING`)
  - About Section (`ABOUT BACKTEST OF CHART`)
  - Features Section (6 planned platform capabilities clearly labelled for Phases 3–6)
  - Supported Markets Section (`Forex`, `Metals`, `Indices`, `Cryptocurrency` — marked as intended markets)
  - Historical Data Sources Section (`Dukascopy` and `Binance` — marked as planned Phase 2 integrations)
  - How It Works Section (6-step planned workflow)
  - Why Backtesting Section (5 educational pillars)
  - FAQ Section (6 interactive Q&A items)
  - Disclaimer Section & Footer
- **Backtest Setup Page (`/backtest`)**:
  - Market Selector (`Forex`, `Metals`, `Indices`, `Cryptocurrency`)
  - Instrument Selector Area (Prepared for Phase 2 API integration)
  - Timeframe Selector (`M1`, `M5`, `M15` default, `M30`, `H1`, `H4`, `D1`)
  - Historical Date Selector (Prepared for Phase 2 historical date coverage binding)
  - Continue to Backtest Workspace CTA (Displays transparent Phase 1 status summary)
- **Legal & Support Starter Pages**:
  - Privacy Policy (`/privacy`)
  - Terms of Use (`/terms`)
  - Contact (`/contact`)

---

## Local Development & Build Commands

```bash
# 1. Navigate to the project directory
cd "d:\mc backtest\backtest-of-chart"

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Run type-check and production build
npm run build

# 5. Preview the production build locally
npm run preview
```
