# Testing Guide

## Local Testing Checklist

Before committing any changes, ensure all of the following pass:

### 1. Server Restart
**CRITICAL**: After making code changes, always restart the server:
```bash
pkill -9 node && npm start
```
Node.js caches modules, so changes won't be reflected until restart.

### 2. Functional Tests

#### Single Token Analysis
1. Navigate to `http://localhost:3000`
2. Enter a single token ID (e.g., `bitcoin`)
3. Select a timeframe
4. Click "Analyze"
5. Verify all metrics display:
   - Sharpe Ratio
   - Sortino Ratio  
   - Annualized Return
   - Volatility
   - Downside Volatility
   - Correlation to S&P 500
   - Correlation to Bitcoin

#### Multiple Token Comparison
1. Enter first token (e.g., `bitcoin`)
2. Click "+ Add Another Token"
3. Enter second token (e.g., `ethereum`)
4. Click "Analyze"
5. Verify both tokens display side-by-side
6. Verify "VS" divider appears between tokens
7. Verify winner text shows comparative analysis

#### Dynamic Token Management
1. Test adding multiple tokens (3+)
2. Test removing tokens via × button
3. Verify can't remove last remaining token
4. Verify remove buttons appear/disappear correctly

### 3. API Tests

```bash
# Test API key configuration
curl -s http://localhost:3000/api/config

# Test single token analysis
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"tokens": ["bitcoin"], "timeframe": 90}'

# Test multiple tokens
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"tokens": ["bitcoin", "ethereum"], "timeframe": 90}'
```

### 4. Error Handling Tests

Test these error scenarios:
- Empty token input (should show validation message)
- Invalid token ID (should show error message)
- Network timeout
- Invalid API key

### 5. UI/UX Tests

- Verify "How It Works" section renders correctly
- Test hover effects on feature list items
- Verify gradient text on headings
- Test button animations
- Check responsive design on mobile viewport
- Verify loading spinner appears during analysis

### 6. Cross-Browser Testing

Test on:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Production Testing (Vercel)

After deploying to Vercel:
1. Wait 1-2 minutes for deployment to complete
2. Visit production URL
3. Run full functional test suite
4. Verify environment variables are set in Vercel dashboard
5. Check Vercel function logs for any errors

## Common Issues

### Issue: "Missing required fields" error
**Cause**: Server running old code
**Fix**: Restart server with `pkill -9 node && npm start`

### Issue: Correlation calculations fail
**Cause**: S&P 500 API might be rate-limited
**Fix**: Wait a few minutes and retry

### Issue: Invalid API key errors
**Cause**: COINGECKO_API_KEY not set in .env
**Fix**: Check .env file has `COINGECKO_API_KEY=your-key-here`

## Automated Testing (Future)

Consider adding:
- Unit tests for calculation functions
- Integration tests for API endpoints
- E2E tests with Playwright or Cypress
- CI/CD pipeline with GitHub Actions

