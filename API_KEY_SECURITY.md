# API Key Security & Pro Upgrade Guide

## API Key Privacy ✅

Your CoinGecko API key is **fully private** and secure:

### Server-Side Only
- The API key is stored in `.env` file (which is in `.gitignore`)
- The key is **never** sent from the frontend to the server
- The frontend only sends `tokens` and `timeframe` - no API key
- The server uses `process.env.COINGECKO_API_KEY` which is server-side only

### GitHub Safety
- `.env` is in `.gitignore` - it will **never** be committed to GitHub
- Your API key is not visible in any repository files
- Only you have access to the `.env` file locally

### User Safety
- Users cannot scrape or see your API key
- All API requests are made server-side
- The key never appears in browser DevTools or network requests visible to users

## Upgrading to Pro API

### Current Limitation
- Demo API keys are limited to **365 days** of historical data
- Pro API keys allow **unlimited** historical data (up to 10 years)

### How to Upgrade

1. **Get Pro API Key**
   - Sign up for CoinGecko Pro API at: https://www.coingecko.com/en/api/pricing
   - Get your new Pro API key (format: `CG-...`)

2. **Update `.env` File**
   ```bash
   COINGECKO_API_KEY=your-new-pro-api-key-here
   ```

3. **No Code Changes Needed!**
   - The code already handles Pro vs Demo API keys automatically
   - The server tries Pro API first, then falls back to Demo if needed
   - Just update the `.env` file and restart the server

4. **Restart Server**
   ```bash
   npm start
   ```

### How It Works

The server automatically detects Pro vs Demo keys:
- **Pro API**: Uses `https://pro-api.coingecko.com/api/v3/` with `x_cg_pro_api_key`
- **Demo API**: Uses `https://api.coingecko.com/api/v3/` with `x_cg_demo_api_key`

The code in `server.js` handles both automatically:
```javascript
const isDemoKey = apiKey.startsWith('CG-') && !apiKey.includes('pro');
// Automatically uses correct endpoint and parameter
```

### Testing Pro API

After upgrading:
1. Try analyzing with a 3-year or 5-year timeframe
2. Should work without any "Invalid API key" errors
3. All existing functionality remains the same

### Cost Considerations

- Pro API has usage limits based on your plan
- Monitor usage in your CoinGecko dashboard
- The app makes efficient API calls (batched requests where possible)

## Security Best Practices

1. ✅ Never commit `.env` to Git (already in `.gitignore`)
2. ✅ Never share your API key publicly
3. ✅ Rotate keys if you suspect compromise
4. ✅ Use environment variables for all sensitive data
5. ✅ Server-side only API key usage (already implemented)

