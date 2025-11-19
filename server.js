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

// Helper function to fetch 10-Year U.S. Treasury yield (risk-free rate)
// Data source: Federal Reserve Economic Data (FRED) - DGS10 series
// This is the market yield on U.S. Treasury securities at 10-year constant maturity,
// widely used as the benchmark risk-free rate in financial analysis
async function fetchTreasuryRate() {
  // Primary source: FRED API (Federal Reserve Bank of St. Louis)
  // Most reliable and frequently updated source for Treasury yields
  try {
    const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: {
        series_id: 'DGS10', // Daily 10-Year Treasury Constant Maturity Rate
        api_key: 'demo', // Free API key available at: https://fred.stlouisfed.org/docs/api/api_key.html
        file_type: 'json',
        sort_order: 'desc',
        limit: 1
      },
      timeout: 5000
    });

    if (response.data && response.data.observations && response.data.observations.length > 0) {
      const latestRate = parseFloat(response.data.observations[0].value);
      if (!isNaN(latestRate) && latestRate > 0) {
        console.log(`Fetched 10-Year Treasury yield from FRED: ${latestRate}%`);
        return latestRate;
      }
    }
  } catch (error) {
    console.log('FRED API failed, trying alternative sources...');
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

  // Final fallback: return a reasonable default based on recent 10-Year Treasury rates
  // As of November 2024, the 10-Year Treasury yield ranges from ~4.0% to 4.8%
  // Using 4.25% as a conservative middle estimate
  // Note: In production, consider:
  // 1. Caching the last successful fetch
  // 2. Using a paid financial data API with higher rate limits
  // 3. Storing historical rates as backup
  console.log('Using fallback Treasury rate: 4.25% (all APIs failed)');
  return 4.25;
}

// Helper function to calculate comprehensive return metrics
function calculateReturns(prices, timeframeDays) {
  if (prices.length < 2) {
    throw new Error('Insufficient price data');
  }

  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  
  // 1. Period Return (Simple Return): Total return from start to end
  const periodReturn = (endPrice - startPrice) / startPrice;
  
  // 2. Calculate actual time period in years
  const years = timeframeDays / 365;
  
  // 3. CAGR (Compound Annual Growth Rate): Geometric mean return
  // Formula: ((Ending Value / Beginning Value) ^ (1 / Years)) - 1
  const cagr = Math.pow(endPrice / startPrice, 1 / years) - 1;
  
  // 4. Annualized Return (Arithmetic Mean): Mean of daily returns annualized
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(dailyReturn);
  }
  const meanDailyReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedMeanReturn = meanDailyReturn * 252; // 252 trading days
  
  return {
    periodReturn: periodReturn,
    cagr: cagr,
    annualizedReturn: annualizedMeanReturn,
    returns: returns, // Return the daily returns array for other calculations
    timeframeDays: timeframeDays,
    years: years
  };
}

// Helper function to calculate Sharpe ratio
function calculateSharpeRatio(prices, riskFreeRate, dailyReturns = null) {
  if (prices.length < 2) {
    throw new Error('Insufficient price data');
  }

  // Use provided daily returns or calculate them
  const returns = dailyReturns || (() => {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      r.push(dailyReturn);
    }
    return r;
  })();

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation (using sample variance with n-1 denominator for unbiased estimator)
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  // Annualize all components before calculating Sharpe ratio
  const annualizedMeanReturn = meanReturn * 252;
  const annualizedVolatility = stdDev * Math.sqrt(252);
  const annualizedRiskFreeRate = riskFreeRate / 100; // Already annual

  if (annualizedVolatility === 0) {
    return {
      sharpeRatio: 0,
      meanReturn: annualizedMeanReturn,
      volatility: annualizedVolatility,
      dailyReturns: returns.length
    };
  }

  const sharpeRatio = (annualizedMeanReturn - annualizedRiskFreeRate) / annualizedVolatility;

  return {
    sharpeRatio: sharpeRatio,
    meanReturn: annualizedMeanReturn,
    volatility: annualizedVolatility,
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
function calculateSortinoRatio(prices, riskFreeRate, dailyReturns = null) {
  if (prices.length < 2) {
    throw new Error('Insufficient price data');
  }

  // Use provided daily returns or calculate them
  const returns = dailyReturns || (() => {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      r.push(dailyReturn);
    }
    return r;
  })();

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate downside deviation using standard Sortino methodology
  // Target return is typically 0 or MAR (Minimum Acceptable Return)
  // We use 0 as the target, meaning we only penalize negative returns
  const targetReturn = 0;
  
  // Calculate downside deviation: sqrt(sum(min(return - target, 0)^2) / n)
  // This is the standard approach - includes all observations, not just negative returns
  let sumSquaredDownside = 0;
  let downsideCount = 0;
  
  for (let i = 0; i < returns.length; i++) {
    const deviation = returns[i] - targetReturn;
    if (deviation < 0) {
      sumSquaredDownside += deviation * deviation;
      downsideCount++;
    }
  }

  // Annualize components
  const annualizedMeanReturn = meanReturn * 252;
  const annualizedRiskFreeRate = riskFreeRate / 100;
  
  // If no negative returns, downside deviation is 0, Sortino is infinite
  if (downsideCount === 0 || sumSquaredDownside === 0) {
    return {
      sortinoRatio: 999,
      meanReturn: annualizedMeanReturn,
      downsideDeviation: 0,
      downsideVolatility: 0
    };
  }

  // Use n-1 for sample downside deviation (unbiased estimator)
  const downsideVariance = sumSquaredDownside / (downsideCount - 1);
  const downsideDeviation = Math.sqrt(downsideVariance);
  const annualizedDownsideVolatility = downsideDeviation * Math.sqrt(252);

  // Calculate Sortino ratio (annualized)
  if (annualizedDownsideVolatility === 0) {
    return {
      sortinoRatio: 999,
      meanReturn: annualizedMeanReturn,
      downsideDeviation: downsideDeviation,
      downsideVolatility: annualizedDownsideVolatility
    };
  }

  const sortinoRatio = (annualizedMeanReturn - annualizedRiskFreeRate) / annualizedDownsideVolatility;

  return {
    sortinoRatio: sortinoRatio,
    meanReturn: annualizedMeanReturn,
    downsideDeviation: downsideDeviation,
    downsideVolatility: annualizedDownsideVolatility,
    dailyReturns: returns.length
  };
}

// API endpoint to analyze tokens
app.post('/api/analyze', async (req, res) => {
  try {
    let { apiKey, tokens, token1, token2, timeframe = 365 } = req.body;

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

    // Check if timeframe exceeds Demo API limitations (365 days)
    const isDemoKey = apiKey.startsWith('CG-') && !apiKey.includes('pro');
    const maxDaysForDemo = 365;
    
    if (isDemoKey && timeframe > maxDaysForDemo) {
      return res.status(400).json({
        success: false,
        error: `CoinGecko Demo API keys are limited to ${maxDaysForDemo} days (1 year) of historical data. Your current timeframe (${timeframe} days) exceeds this limit. Please select a shorter timeframe or upgrade to a CoinGecko Pro API key for longer historical analysis.`,
        maxTimeframe: maxDaysForDemo,
        requestedTimeframe: timeframe
      });
    }

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
        try {
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
        } catch (demoError) {
          // Check if error is due to timeframe limitation
          if (demoError.response && demoError.response.status === 429) {
            throw new Error(`Rate limit exceeded. Please try again in a moment or upgrade to a Pro API key.`);
          }
          if (demoError.response && (demoError.response.status === 401 || demoError.response.status === 403)) {
            throw new Error(`API authentication failed for ${timeframe} days. Demo API keys may be limited to 365 days of data. Consider using a shorter timeframe or upgrading to a Pro API key.`);
          }
          throw demoError;
        }
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

      // Calculate low and high prices over the period
      const lowPrice = Math.min(...prices);
      const highPrice = Math.max(...prices);
      const currentPrice = prices[prices.length - 1];
      const startPrice = prices[0];
      console.log(`[DEBUG] ${tokenId} prices: low=$${lowPrice}, high=$${highPrice}, current=$${currentPrice}`);

      // Calculate comprehensive return metrics first
      const returnMetrics = calculateReturns(prices, timeframe);
      
      // Calculate Sharpe and Sortino ratios (pass daily returns to avoid recalculation)
      const sharpeStats = calculateSharpeRatio(prices, treasuryRate, returnMetrics.returns);
      const sortinoStats = calculateSortinoRatio(prices, treasuryRate, returnMetrics.returns);
      
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
        // Price data
        startPrice: startPrice,
        currentPrice: currentPrice,
        lowPrice: lowPrice,
        highPrice: highPrice,
        // Return metrics
        periodReturn: returnMetrics.periodReturn,          // Simple return from start to end
        cagr: returnMetrics.cagr,                          // Compound Annual Growth Rate
        annualizedReturn: returnMetrics.annualizedReturn,  // Arithmetic mean of daily returns * 252
        meanReturn: sharpeStats.meanReturn,                // Legacy: same as annualizedReturn (for backward compatibility)
        // Risk metrics
        volatility: sharpeStats.volatility,
        maxDrawdown: mddStats.maxDrawdown,
        sharpeRatio: sharpeStats.sharpeRatio,
        sortinoRatio: sortinoStats.sortinoRatio,
        downsideVolatility: sortinoStats.downsideVolatility,
        // Correlation metrics
        correlationToSP500: correlationToSP500,
        correlationToBitcoin: correlationToBitcoin,
        // Metadata
        dataPoints: sharpeStats.dailyReturns,
        timeframeDays: returnMetrics.timeframeDays,
        timeframeYears: returnMetrics.years
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

