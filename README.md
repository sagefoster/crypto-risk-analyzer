# Crypto Risk Analyzer

A professional web application for analyzing cryptocurrency risk using traditional finance metrics. Compare multiple crypto assets using Sharpe ratio, Sortino ratio, market correlations, and volatility analysis with real-time data from CoinGecko.

## Features

- **Sharpe Ratio Analysis** - Risk-adjusted returns compared to US Treasury bonds
- **Sortino Ratio Analysis** - Downside risk-focused performance measurement
- **Market Correlation** - Track relationships with S&P 500 and Bitcoin
- **Volatility Metrics** - Annualized returns, standard deviation, and downside volatility
- **Multi-Asset Comparison** - Analyze and compare unlimited crypto assets
- **Real-time Data** - Live market data from CoinGecko API
- **Dynamic Risk-Free Rate** - Automatically fetches current US Treasury rates
- **Uniswap-inspired UI** - Modern, professional design
- **Multiple Timeframes** - Analyze over 30, 90, 180, or 365 days

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- CoinGecko API key (Demo or Pro)

## Installation

1. Clone this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file and add your CoinGecko API key:

```bash
COINGECKO_API_KEY=your-api-key-here
```

## Usage

1. Start the server:

```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Enter one or more CoinGecko token IDs (e.g., `bitcoin`, `ethereum`, `cardano`)
   - Start with one asset for individual analysis
   - Click "+ Add Another Token" to compare multiple assets

4. Select a timeframe (default is 90 days)

5. Click "Analyze" to see comprehensive risk metrics

## What You'll Get

For each cryptocurrency, the tool calculates:

- **Sharpe Ratio** - How much excess return per unit of risk (higher is better)
- **Sortino Ratio** - Similar to Sharpe, but only penalizes downside volatility
- **Annualized Return** - Yearly return percentage based on the selected timeframe
- **Volatility** - Standard deviation of returns (annualized)
- **Downside Volatility** - Volatility of only negative returns
- **Correlation to S&P 500** - How the asset moves with traditional markets
- **Correlation to Bitcoin** - How the asset moves with Bitcoin (crypto's benchmark)

Plus contextual interpretations explaining what each metric means for your investment!

## API Endpoints

### POST /api/analyze

Analyzes one or more cryptocurrency tokens and returns comprehensive risk metrics.

**Request Body:**
```json
{
  "tokens": ["bitcoin", "ethereum", "cardano"],
  "timeframe": 90
}
```

**Response:**
```json
{
  "success": true,
  "riskFreeRate": 4.5,
  "timeframe": 90,
  "results": [
    {
      "id": "bitcoin",
      "sharpeRatio": 1.234,
      "sortinoRatio": 1.567,
      "meanReturn": 0.15,
      "volatility": 0.25,
      "downsideVolatility": 0.18,
      "correlationToSP500": 0.32,
      "correlationToBitcoin": 1.0,
      "dataPoints": 90
    }
  ]
}
```

## Calculation Methods

### Sharpe Ratio
```
Sharpe Ratio = (Mean Return - Risk-Free Rate) / Standard Deviation
```
Measures risk-adjusted returns using total volatility. Higher is better.

### Sortino Ratio
```
Sortino Ratio = (Mean Return - Risk-Free Rate) / Downside Deviation
```
Similar to Sharpe but only penalizes downside volatility, better for asymmetric returns.

### Correlation Coefficient
```
Correlation = Covariance(X, Y) / (σx × σy)
```
Pearson correlation measuring linear relationship between assets (-1 to +1).

### Annualization
- Returns: Multiply by 252 (trading days)
- Volatility: Multiply by √252
- Ratios: Multiply by √252

## CoinGecko API

This application supports both Demo and Pro CoinGecko API keys:
1. Sign up for a free account at [CoinGecko](https://www.coingecko.com/en/api)
2. Get your API key (Demo or Pro) from your dashboard
3. Add it to your `.env` file as `COINGECKO_API_KEY`

The application automatically detects your key type and uses the appropriate endpoint.

## US Treasury Rate

The application attempts to fetch the current 10-Year US Treasury rate from:
1. FRED API (Federal Reserve Economic Data)
2. Alternative financial data APIs
3. Falls back to a reasonable default (4.5%) if all APIs fail

## Project Structure

```
.
├── server.js                      # Express backend (API + calculations)
├── package.json                   # Dependencies and scripts
├── .env                          # Environment variables (API key)
├── vercel.json                   # Vercel deployment config
├── CALCULATION_VERIFICATION.md   # Mathematical verification docs
├── public/
│   ├── index.html               # Main HTML page
│   ├── style.css                # Uniswap-inspired styling
│   └── script.js                # Frontend JavaScript
└── README.md                    # This file
```

## Error Handling

The application handles various scenarios:
- Invalid or expired API keys (401/403 errors)
- Invalid token IDs (404 errors)
- Network errors and timeouts
- API rate limits (429 errors)
- Insufficient price data
- Missing or invalid correlations

All errors display user-friendly messages with actionable solutions.

## Deployment

### Vercel (Recommended)
```bash
npm run deploy
```

The app is production-ready and configured for Vercel serverless deployment.

## Calculation Accuracy

All formulas have been verified against industry standards (CFA Institute methodology). 
See `CALCULATION_VERIFICATION.md` for detailed mathematical proofs and manual calculations.

✅ All metrics are mathematically correct and follow finance industry best practices.

## License

MIT

## Notes

- Results are based on historical data and do not predict future performance
- Sharpe/Sortino ratios should be compared within similar asset classes
- Correlation values can change significantly over different time periods
- Low correlation assets provide better portfolio diversification
- Consider multiple metrics together for comprehensive risk assessment

