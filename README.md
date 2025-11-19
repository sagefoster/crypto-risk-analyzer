# Cryptocurrency Sharpe Ratio Analyzer

A web application that analyzes and compares the Sharpe ratios of two cryptocurrency tokens using historical price data from CoinGecko API and the current US Treasury rate as the risk-free rate.

## Features

- Compare Sharpe ratios of two cryptocurrency tokens
- Real-time data from CoinGecko API
- Dynamic US Treasury rate fetching
- Uniswap-inspired modern UI design
- Multiple timeframe options (30, 90, 180, 365 days)

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- CoinGecko API key (Pro API key recommended)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

1. Start the server:

```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Enter your CoinGecko API key in the input field

4. Enter the CoinGecko token IDs for the two assets you want to compare (e.g., `bitcoin`, `ethereum`)

5. Select a timeframe (default is 90 days)

6. Click "Analyze" to calculate and compare Sharpe ratios

## API Endpoints

### POST /api/analyze

Analyzes two cryptocurrency tokens and returns their Sharpe ratios.

**Request Body:**
```json
{
  "apiKey": "your-coingecko-api-key",
  "token1": "bitcoin",
  "token2": "ethereum",
  "timeframe": 90
}
```

**Response:**
```json
{
  "success": true,
  "riskFreeRate": 4.5,
  "timeframe": 90,
  "token1": {
    "id": "bitcoin",
    "sharpeRatio": 1.234,
    "meanReturn": 0.15,
    "volatility": 0.25,
    "dataPoints": 90
  },
  "token2": {
    "id": "ethereum",
    "sharpeRatio": 1.567,
    "meanReturn": 0.18,
    "volatility": 0.30,
    "dataPoints": 90
  }
}
```

## Sharpe Ratio Calculation

The Sharpe ratio is calculated using the formula:

```
Sharpe Ratio = (Mean Return - Risk-Free Rate) / Standard Deviation
```

- **Mean Return**: Average daily return, annualized
- **Risk-Free Rate**: Current 10-Year US Treasury rate (fetched dynamically)
- **Standard Deviation**: Volatility of returns, annualized

The ratio is annualized by multiplying by √252 (trading days per year).

## CoinGecko API

This application uses the CoinGecko Pro API. You'll need to:
1. Sign up for a CoinGecko account
2. Get a Pro API key from your dashboard
3. Enter the API key in the web interface

The API key is sent securely to the backend and used to authenticate requests to CoinGecko.

## US Treasury Rate

The application attempts to fetch the current 10-Year US Treasury rate from:
1. FRED API (Federal Reserve Economic Data)
2. Alternative financial data APIs
3. Falls back to a reasonable default (4.5%) if all APIs fail

## Project Structure

```
.
├── server.js          # Express backend server
├── package.json       # Dependencies and scripts
├── public/
│   ├── index.html    # Main HTML page
│   ├── style.css     # Uniswap-inspired styling
│   └── script.js     # Frontend JavaScript
├── .gitignore        # Git ignore file
└── README.md         # This file
```

## Error Handling

The application handles various error scenarios:
- Invalid API keys
- Invalid token IDs
- Network errors
- API rate limits
- Insufficient data

Error messages are displayed to the user in a user-friendly format.

## License

MIT

## Notes

- The application requires a CoinGecko Pro API key for authentication
- Historical data availability depends on CoinGecko's data coverage
- Treasury rate fetching may require internet connectivity
- Results are calculated based on historical data and may not predict future performance

