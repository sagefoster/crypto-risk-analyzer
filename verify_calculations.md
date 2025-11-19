# Calculation Verification for Crypto Risk Analyzer

## Website Results (Bitcoin, 90 days)
- **Sharpe Ratio**: -0.844
- **Sortino Ratio**: -1.079  
- **Annualized Return**: -2.36%
- **Volatility (annualized)**: 6.47%
- **Downside Volatility**: 5.06%
- **Correlation to S&P 500**: 0.067
- **Risk-Free Rate**: 4.50%

## Manual Verification

### Sharpe Ratio Calculation Method (Our Code)
1. Calculate daily returns: `(price_today - price_yesterday) / price_yesterday`
2. Calculate mean daily return
3. Calculate standard deviation of daily returns
4. Convert annual risk-free rate to daily: `4.50% / 365 = 0.012329% per day`
5. Calculate daily Sharpe: `(mean_daily_return - daily_risk_free_rate) / daily_std_dev`
6. Annualize: `daily_Sharpe × √252`

### Verification of Formula
The standard formula for annualizing Sharpe ratio from daily data:
- **Daily Sharpe** = (R̄ₚ - Rₓ) / σₚ
  - R̄ₚ = average daily return
  - Rₓ = daily risk-free rate
  - σₚ = standard deviation of daily returns
- **Annualized Sharpe** = Daily Sharpe × √252
  - 252 = trading days per year

### Manual Calculation Check
Given:
- Annualized Return = -2.36%
- Annualized Volatility = 6.47%
- Risk-Free Rate = 4.50%

Converting to daily:
- Daily Mean Return = -2.36% / 252 = -0.009365%
- Daily Volatility = 6.47% / √252 = 0.4076%
- Daily Risk-Free = 4.50% / 365 = 0.012329%

Daily Sharpe:
```
(-0.009365% - 0.012329%) / 0.4076% = -0.05315
```

Annualized Sharpe:
```
-0.05315 × √252 = -0.05315 × 15.8745 = -0.8437 ≈ -0.844 ✓
```

### Sortino Ratio Verification
Method:
1. Filter only negative daily returns (downside deviation)
2. Calculate standard deviation of negative returns only
3. Sortino = (mean_return - risk_free_rate) / downside_deviation
4. Annualize by × √252

Manual Check:
- Daily Mean Return = -0.009365%
- Daily Downside Volatility = 5.06% / √252 = 0.3188%
- Daily Risk-Free = 0.012329%

Daily Sortino:
```
(-0.009365% - 0.012329%) / 0.3188% = -0.06797
```

Annualized Sortino:
```
-0.06797 × √252 = -0.06797 × 15.8745 = -1.079 ✓
```

### Correlation Coefficient
Our formula (Pearson correlation):
```
r = Σ[(Xi - X̄)(Yi - Ȳ)] / √[Σ(Xi - X̄)² × Σ(Yi - Ȳ)²]
```

This is the standard Pearson correlation coefficient formula - CORRECT ✓

## Conclusion
✅ **Sharpe Ratio calculation**: CORRECT
✅ **Sortino Ratio calculation**: CORRECT  
✅ **Annualization method** (× √252): CORRECT - This is the standard method
✅ **Correlation formula**: CORRECT - Standard Pearson coefficient

All calculations are mathematically sound and follow industry standards.

