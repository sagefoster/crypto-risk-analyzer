require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper function to fetch US Treasury rate from FRED API
async function fetchTreasuryRate() {
  // Try FRED API first (requires free API key, but works with demo key for limited requests)
  try {
    const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: {
        series_id: 'DGS10',
        api_key: 'demo', // Free API key can be obtained from https://fred.stlouisfed.org/docs/api/api_key.html
        file_type: 'json',
        sort_order: 'desc',
        limit: 1
      },
      timeout: 5000
    });

    if (response.data && response.data.observations && response.data.observations.length > 0) {
      const latestRate = parseFloat(response.data.observations[0].value);
      if (!isNaN(latestRate) && latestRate > 0) {
        console.log(`Fetched Treasury rate from FRED: ${latestRate}%`);
        return latestRate;
      }
    }
  } catch (error) {
    console.log('FRED API failed, trying alternative method...');
  }

  // Alternative: Try fetching from Treasury.gov JSON endpoint
  try {
    const response = await axios.get('https://www.treasury.gov/resource-center/data-chart-center/interest-rates/Datasets/yield.xml', {
      headers: {
        'Accept': 'application/xml'
      },
      timeout: 5000
    });
    
    // Parse XML to extract 10-year rate
    // This is a simplified approach - in production, use proper XML parser
    const xmlText = response.data;
    const match = xmlText.match(/<BC_10YEAR>([\d.]+)<\/BC_10YEAR>/);
    if (match && match[1]) {
      const rate = parseFloat(match[1]);
      if (!isNaN(rate) && rate > 0) {
        console.log(`Fetched Treasury rate from Treasury.gov: ${rate}%`);
        return rate;
      }
    }
  } catch (error) {
    console.log('Treasury.gov API failed');
  }

  // Try alternative: Use a public financial data source
  try {
    // Using a public endpoint that provides Treasury rates
    const response = await axios.get('https://www.quandl.com/api/v3/datasets/USTREASURY/YIELD.json', {
      params: {
        rows: 1,
        api_key: 'demo'
      },
      timeout: 5000
    });
    
    if (response.data && response.data.dataset && response.data.dataset.data && response.data.dataset.data.length > 0) {
      const latestData = response.data.dataset.data[0];
      const columnNames = response.data.dataset.column_names;
      const tenYearIndex = columnNames ? columnNames.indexOf('10 YR') : -1;
      
      if (tenYearIndex !== -1 && latestData[tenYearIndex]) {
        const rate = parseFloat(latestData[tenYearIndex]);
        if (!isNaN(rate) && rate > 0) {
          console.log(`Fetched Treasury rate from Quandl: ${rate}%`);
          return rate;
        }
      }
    }
  } catch (error) {
    console.log('Alternative API failed');
  }

  // Final fallback: return a reasonable default (4.5% as of 2024)
  // Note: This is a conservative estimate. In production, consider:
  // 1. Caching the last successful fetch
  // 2. Using a paid financial data API
  // 3. Allowing users to input the rate manually
  console.log('Using fallback Treasury rate: 4.5% (all APIs failed)');
  return 4.5;
}

// Helper function to calculate Sharpe ratio
function calculateSharpeRatio(prices, riskFreeRate) {
  if (prices.length < 2) {
    throw new Error('Insufficient price data');
  }

  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(dailyReturn);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Convert annual risk-free rate to daily rate
  const dailyRiskFreeRate = riskFreeRate / 100 / 365;

  // Calculate Sharpe ratio (annualized)
  if (stdDev === 0) {
    return 0;
  }

  const sharpeRatio = (meanReturn - dailyRiskFreeRate) / stdDev;
  // Annualize by multiplying by sqrt(252) for daily data
  const annualizedSharpe = sharpeRatio * Math.sqrt(252);

  return {
    sharpeRatio: annualizedSharpe,
    meanReturn: meanReturn * 252, // Annualized
    volatility: stdDev * Math.sqrt(252), // Annualized
    dailyReturns: returns.length
  };
}

// Helper function to calculate Sortino ratio (focuses on downside risk)
function calculateSortinoRatio(prices, riskFreeRate) {
  if (prices.length < 2) {
    throw new Error('Insufficient price data');
  }

  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(dailyReturn);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Convert annual risk-free rate to daily rate
  const dailyRiskFreeRate = riskFreeRate / 100 / 365;

  // Calculate downside deviation (only negative returns below target)
  // Target is typically 0 or risk-free rate - we'll use 0 for simplicity
  const targetReturn = 0;
  const downsideReturns = returns.filter(r => r < targetReturn);
  
  if (downsideReturns.length === 0) {
    // If no negative returns, downside deviation is 0, Sortino is undefined/infinite
    // Return a high value to indicate excellent downside protection
    return {
      sortinoRatio: 999,
      meanReturn: meanReturn * 252,
      downsideDeviation: 0,
      downsideVolatility: 0
    };
  }

  // Calculate downside deviation (standard deviation of negative returns)
  const downsideMean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / downsideReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  // Calculate Sortino ratio (annualized)
  if (downsideDeviation === 0) {
    return {
      sortinoRatio: 999,
      meanReturn: meanReturn * 252,
      downsideDeviation: 0,
      downsideVolatility: 0
    };
  }

  const sortinoRatio = (meanReturn - dailyRiskFreeRate) / downsideDeviation;
  // Annualize by multiplying by sqrt(252) for daily data
  const annualizedSortino = sortinoRatio * Math.sqrt(252);

  return {
    sortinoRatio: annualizedSortino,
    meanReturn: meanReturn * 252, // Annualized
    downsideDeviation: downsideDeviation,
    downsideVolatility: downsideDeviation * Math.sqrt(252), // Annualized
    dailyReturns: returns.length
  };
}

// API endpoint to analyze tokens
app.post('/api/analyze', async (req, res) => {
  try {
    let { apiKey, token1, token2, timeframe = 90 } = req.body;

    // Use environment variable API key if not provided in request
    if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.COINGECKO_API_KEY;
    }

    // Validate inputs
    if (!apiKey || !token1 || !token2) {
      return res.status(400).json({ error: 'Missing required fields: apiKey (or set COINGECKO_API_KEY in .env), token1, token2' });
    }

    // Fetch Treasury rate
    const treasuryRate = await fetchTreasuryRate();
    const dailyRiskFreeRate = treasuryRate / 365;

    // Fetch historical data for both tokens
    // Auto-detect if it's a Pro or Demo API key and use appropriate endpoint
    const makeApiRequest = async (tokenId) => {
      // Try Pro API first (for Pro API keys)
      try {
        const response = await axios.get(`https://pro-api.coingecko.com/api/v3/coins/${tokenId}/market_chart`, {
          params: {
            vs_currency: 'usd',
            days: timeframe,
            x_cg_pro_api_key: apiKey
          },
          headers: {
            'User-Agent': 'Sharpe-Ratio-Analyzer/1.0',
            'Accept': 'application/json'
          },
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });
        
        // Check if response indicates it's a demo key
        if (response.data && response.data.error_code === 10011) {
          throw new Error('DEMO_KEY_DETECTED');
        }
        
        if (response.status === 200 && response.data.prices) {
          return response;
        }
        throw new Error('Pro API failed');
      } catch (proError) {
        // If Pro API fails or indicates demo key, use Demo API endpoint
        console.log(`Using Demo API for ${tokenId}...`);
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart`, {
          params: {
            vs_currency: 'usd',
            days: timeframe,
            x_cg_demo_api_key: apiKey
          },
          headers: {
            'User-Agent': 'Sharpe-Ratio-Analyzer/1.0',
            'Accept': 'application/json'
          }
        });
        return response;
      }
    };

    const [token1Data, token2Data] = await Promise.all([
      makeApiRequest(token1),
      makeApiRequest(token2)
    ]);

    // Extract prices from market_chart data
    // The response structure: { prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }
    const token1Prices = token1Data.data.prices.map(p => p[1]);
    const token2Prices = token2Data.data.prices.map(p => p[1]);

    // Calculate Sharpe and Sortino ratios
    const token1Stats = calculateSharpeRatio(token1Prices, treasuryRate);
    const token1Sortino = calculateSortinoRatio(token1Prices, treasuryRate);
    const token2Stats = calculateSharpeRatio(token2Prices, treasuryRate);
    const token2Sortino = calculateSortinoRatio(token2Prices, treasuryRate);

    // Return results
    res.json({
      success: true,
      riskFreeRate: treasuryRate,
      timeframe: timeframe,
      token1: {
        id: token1,
        sharpeRatio: token1Stats.sharpeRatio,
        sortinoRatio: token1Sortino.sortinoRatio,
        meanReturn: token1Stats.meanReturn,
        volatility: token1Stats.volatility,
        downsideVolatility: token1Sortino.downsideVolatility,
        dataPoints: token1Stats.dailyReturns
      },
      token2: {
        id: token2,
        sharpeRatio: token2Stats.sharpeRatio,
        sortinoRatio: token2Sortino.sortinoRatio,
        meanReturn: token2Stats.meanReturn,
        volatility: token2Stats.volatility,
        downsideVolatility: token2Sortino.downsideVolatility,
        dataPoints: token2Stats.dailyReturns
      }
    });
  } catch (error) {
    console.error('Error analyzing tokens:', error);
    
    if (error.response) {
      // API error response
      const status = error.response.status;
      let errorMessage = 'API request failed';
      
      if (status === 401 || status === 403) {
        errorMessage = 'Invalid API key. Please check your CoinGecko API key.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 404) {
        errorMessage = 'Token not found. Please check the token IDs (e.g., "bitcoin", "ethereum").';
      } else {
        errorMessage = error.response.data?.error || error.response.data?.message || 'API request failed';
      }
      
      return res.status(status).json({
        error: errorMessage,
        details: error.response.data,
        statusCode: status
      });
    } else if (error.request) {
      // Request made but no response
      return res.status(500).json({
        error: 'No response from CoinGecko API. Please check your internet connection.',
        details: error.message
      });
    } else {
      // Other error
      return res.status(500).json({
        error: 'Server error',
        details: error.message
      });
    }
  }
});

// Endpoint to check if API key is configured
app.get('/api/config', (req, res) => {
  res.json({
    hasApiKey: !!process.env.COINGECKO_API_KEY
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

