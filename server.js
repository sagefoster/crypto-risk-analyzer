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

// Helper function to calculate Maximum Drawdown
function calculateMaxDrawdown(prices) {
  if (prices.length < 2) {
    return 0;
  }

  let maxDrawdown = 0;
  let peak = prices[0];
  let peakIndex = 0;
  let troughIndex = 0;
  let maxDrawdownEnd = 0;

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      peakIndex = i;
    }
    
    const drawdown = (peak - prices[i]) / peak;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      troughIndex = i;
      maxDrawdownEnd = peakIndex;
    }
  }

  return {
    maxDrawdown: maxDrawdown,
    peakIndex: maxDrawdownEnd,
    troughIndex: troughIndex
  };
}

// Helper function to calculate correlation between two price series
function calculateCorrelation(prices1, prices2) {
  if (prices1.length !== prices2.length || prices1.length < 2) {
    return null;
  }

  // Calculate returns for both series
  const returns1 = [];
  const returns2 = [];
  
  for (let i = 1; i < prices1.length; i++) {
    returns1.push((prices1[i] - prices1[i - 1]) / prices1[i - 1]);
    returns2.push((prices2[i] - prices2[i - 1]) / prices2[i - 1]);
  }

  // Calculate means
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

  // Calculate correlation coefficient
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
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
    let { apiKey, tokens, token1, token2, timeframe = 90 } = req.body;

    // Use environment variable API key if not provided in request
    if (!apiKey || apiKey.trim() === '') {
      apiKey = process.env.COINGECKO_API_KEY;
    }

    // Support both old format (token1, token2) and new format (tokens array)
    let tokenArray = tokens;
    if (!tokenArray && token1 && token2) {
      // Legacy support for old format
      tokenArray = [token1, token2];
    }

    // Validate inputs
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing required field: apiKey (or set COINGECKO_API_KEY in .env)' });
    }

    if (!tokenArray || !Array.isArray(tokenArray) || tokenArray.length === 0) {
      return res.status(400).json({ error: 'Missing required field: tokens (array of token IDs)' });
    }

    // Remove duplicates and empty strings
    tokenArray = [...new Set(tokenArray.filter(t => t && t.trim()))];
    
    if (tokenArray.length === 0) {
      return res.status(400).json({ error: 'At least one valid token ID is required' });
    }

    // Fetch Treasury rate
    const treasuryRate = await fetchTreasuryRate();
    const dailyRiskFreeRate = treasuryRate / 365;

    // Fetch historical data for all tokens
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

    // Fetch S&P 500 data for correlation analysis
    const fetchSP500Data = async () => {
      try {
        // Use Yahoo Finance API to get S&P 500 (^GSPC) data
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (timeframe * 24 * 60 * 60);
        
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC`, {
          params: {
            period1: startDate,
            period2: endDate,
            interval: '1d'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: 10000
        });

        if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
          const result = response.data.chart.result[0];
          const timestamps = result.timestamp || [];
          const quotes = result.indicators.quote[0];
          const closePrices = quotes.close || [];
          
          // Filter out null values and return as [timestamp, price] pairs
          const prices = [];
          for (let i = 0; i < timestamps.length; i++) {
            if (closePrices[i] !== null) {
              prices.push([timestamps[i] * 1000, closePrices[i]]);
            }
          }
          
          console.log(`Fetched ${prices.length} S&P 500 data points`);
          return prices;
        }
        
        throw new Error('Invalid S&P 500 data format');
      } catch (error) {
        console.error('Failed to fetch S&P 500 data:', error.message);
        return null;
      }
    };

    // Fetch data for all tokens and S&P 500 in parallel
    const [sp500Data, ...tokenDataArray] = await Promise.all([
      fetchSP500Data(),
      ...tokenArray.map(tokenId => makeApiRequest(tokenId))
    ]);

    // Extract Bitcoin prices for correlation (if Bitcoin is in the list)
    const bitcoinIndex = tokenArray.findIndex(id => id.toLowerCase() === 'bitcoin');
    let bitcoinPrices = null;
    
    if (bitcoinIndex !== -1) {
      bitcoinPrices = tokenDataArray[bitcoinIndex].data.prices.map(p => p[1]);
    } else {
      // If Bitcoin isn't in the list, fetch it for correlation purposes
      try {
        const btcData = await makeApiRequest('bitcoin');
        bitcoinPrices = btcData.data.prices.map(p => p[1]);
        console.log('Fetched Bitcoin data for correlation analysis');
      } catch (error) {
        console.log('Could not fetch Bitcoin data for correlation');
      }
    }

    // Process each token's data
    const tokenResults = tokenDataArray.map((tokenData, index) => {
      const tokenId = tokenArray[index];
      
      // Extract prices from market_chart data
      // The response structure: { prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }
      const pricesWithTimestamps = tokenData.data.prices;
      const prices = pricesWithTimestamps.map(p => p[1]);

      // Calculate Sharpe and Sortino ratios
      const sharpeStats = calculateSharpeRatio(prices, treasuryRate);
      const sortinoStats = calculateSortinoRatio(prices, treasuryRate);
      
      // Calculate Maximum Drawdown
      const mddStats = calculateMaxDrawdown(prices);

      // Calculate correlations
      let correlationToSP500 = null;
      let correlationToBitcoin = null;

      // Correlation to S&P 500
      if (sp500Data && sp500Data.length > 0) {
        // Align S&P 500 data with token data by timestamp
        const alignedSP500Prices = [];
        const alignedTokenPrices = [];
        
        for (let i = 0; i < pricesWithTimestamps.length; i++) {
          const tokenTimestamp = pricesWithTimestamps[i][0];
          const tokenPrice = pricesWithTimestamps[i][1];
          
          // Find closest S&P 500 timestamp (within 24 hours)
          const sp500Match = sp500Data.find(sp => Math.abs(sp[0] - tokenTimestamp) < 24 * 60 * 60 * 1000);
          
          if (sp500Match) {
            alignedSP500Prices.push(sp500Match[1]);
            alignedTokenPrices.push(tokenPrice);
          }
        }
        
        if (alignedSP500Prices.length >= 10) {
          correlationToSP500 = calculateCorrelation(alignedTokenPrices, alignedSP500Prices);
        }
      }

      // Correlation to Bitcoin (for all tokens)
      if (bitcoinPrices && bitcoinPrices.length === prices.length) {
        if (tokenId.toLowerCase() === 'bitcoin') {
          // Bitcoin's correlation to itself is always 1.0
          correlationToBitcoin = 1.0;
        } else {
          correlationToBitcoin = calculateCorrelation(prices, bitcoinPrices);
        }
      }

      return {
        id: tokenId,
        meanReturn: sharpeStats.meanReturn,
        volatility: sharpeStats.volatility,
        maxDrawdown: mddStats.maxDrawdown,
        sharpeRatio: sharpeStats.sharpeRatio,
        sortinoRatio: sortinoStats.sortinoRatio,
        downsideVolatility: sortinoStats.downsideVolatility,
        correlationToSP500: correlationToSP500,
        correlationToBitcoin: correlationToBitcoin,
        dataPoints: sharpeStats.dailyReturns
      };
    });

    // Return results
    res.json({
      success: true,
      riskFreeRate: treasuryRate,
      timeframe: timeframe,
      tokens: tokenResults
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

