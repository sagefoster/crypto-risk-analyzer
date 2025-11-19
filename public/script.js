document.addEventListener('DOMContentLoaded', async () => {
    // Prevent browser from restoring scroll position
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    const form = document.getElementById('analysisForm');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const tokensContainer = document.getElementById('tokensContainer');
    const addTokenBtn = document.getElementById('addTokenBtn');
    
    let tokenIndex = 1; // Start at 1 since we already have token0

    // Function to add a new token input
    // @param {boolean} shouldFocus - Whether to focus the new input (default: true)
    function addTokenInput(shouldFocus = true) {
        const tokenGroups = tokensContainer.querySelectorAll('.token-input-group');
        
        // Limit to 5 tokens maximum
        if (tokenGroups.length >= 5) {
            return;
        }
        
        const tokenGroup = document.createElement('div');
        tokenGroup.className = 'token-input-group';
        tokenGroup.setAttribute('data-token-index', tokenIndex);
        
        tokenGroup.innerHTML = `
            <div class="form-group">
                <label for="token${tokenIndex}">Token ID</label>
                <div class="token-input-wrapper">
                    <input type="text" class="token-input" id="token${tokenIndex}" name="token${tokenIndex}" placeholder="e.g., ethereum" required>
                    <button type="button" class="btn-remove-token" aria-label="Remove token">×</button>
                </div>
                <small>CoinGecko token ID (e.g., bitcoin, ethereum)</small>
            </div>
        `;
        
        tokensContainer.appendChild(tokenGroup);
        
        // Add event listener to remove button
        const removeBtn = tokenGroup.querySelector('.btn-remove-token');
        removeBtn.addEventListener('click', () => {
            tokenGroup.remove();
            updateRemoveButtons();
        });
        
        tokenIndex++;
        updateRemoveButtons();
        
        // Focus the newly created input to keep keyboard open on mobile (only when user clicks add button)
        // Use setTimeout to ensure DOM is fully updated
        if (shouldFocus) {
            setTimeout(() => {
                const newInput = tokenGroup.querySelector('.token-input');
                if (newInput) {
                    newInput.focus();
                }
            }, 100);
        }
    }

    // Function to update remove button visibility and add button state
    function updateRemoveButtons() {
        const tokenGroups = tokensContainer.querySelectorAll('.token-input-group');
        
        // Update remove button visibility
        tokenGroups.forEach((group, index) => {
            const removeBtn = group.querySelector('.btn-remove-token');
            if (tokenGroups.length > 1) {
                removeBtn.classList.remove('hidden');
            } else {
                removeBtn.classList.add('hidden');
            }
        });
        
        // Update add button visibility (max 5 tokens)
        if (tokenGroups.length >= 5) {
            addTokenBtn.style.display = 'none';
        } else {
            addTokenBtn.style.display = 'flex';
        }
    }

    // Add event listener to "Add Token" button
    addTokenBtn.addEventListener('click', addTokenInput);

    // Initialize remove button visibility
    updateRemoveButtons();

    // Function to collect all token IDs from the form
    function collectTokens() {
        const tokenInputs = tokensContainer.querySelectorAll('.token-input');
        const tokens = [];
        tokenInputs.forEach(input => {
            const value = input.value.trim().toLowerCase();
            if (value) {
                tokens.push(value);
            }
        });
        return tokens;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous results and errors
        results.classList.add('hidden');
        errorDiv.classList.add('hidden');
        
        // Collect tokens
        const tokens = collectTokens();
        
        if (tokens.length === 0) {
            showError('Please enter at least one token ID');
            return;
        }
        
        // Show loading
        loading.classList.remove('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';

        const timeframe = document.getElementById('timeframe').value;

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tokens,
                    timeframe: parseInt(timeframe)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            // Display results
            displayResults(data);
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'An error occurred while analyzing the tokens. Please check your API key and token IDs.');
        } finally {
            loading.classList.add('hidden');
            analyzeBtn.disabled = false;
            analyzeBtn.querySelector('.btn-text').textContent = 'Analyze';
        }
    });

    function getVolatilityInterpretation(volatility, tokenName, volatilityPct, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content volatility-interpretation';
        
        let interpretation = '';
        let interpretationClass = '';
        
        if (volatility < 0.20) {
            interpretation = `Very low volatility. ${tokenName} showed minimal price fluctuations during the ${timeframeText}, with a standard deviation of ${volatilityPct}%. This indicates stable, predictable price behavior with returns clustering closely around the average.`;
            interpretationClass = 'excellent';
        } else if (volatility < 0.40) {
            interpretation = `Low to moderate volatility. Over ${timeframeText}, ${tokenName}'s daily returns deviated ${volatilityPct}% from the average on an annualized basis. This represents moderate price swings typical of established crypto assets.`;
            interpretationClass = 'good';
        } else if (volatility < 0.70) {
            interpretation = `High volatility. ${tokenName}'s ${volatilityPct}% standard deviation over ${timeframeText} indicates significant price swings. Daily returns varied widely from the average, meaning prices could move dramatically up or down in short periods.`;
            interpretationClass = 'warning';
        } else {
            interpretation = `Extreme volatility. With a standard deviation of ${volatilityPct}% over ${timeframeText}, ${tokenName} experienced severe price fluctuations. This level of volatility means prices regularly moved far from the average—expect large gains or losses.`;
            interpretationClass = 'poor';
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Volatility (Standard Deviation):</strong> Measures price consistency over ${timeframeText}
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>What Standard Deviation Means:</strong> ${volatilityPct}% volatility means that in a typical year, ${tokenName}'s returns will stay within a range of ${volatilityPct}% above or below the average return about 68% of the time (1 standard deviation). Higher volatility = bigger price swings and more uncertainty.</p>
                <p><strong>Context:</strong> This is calculated from ${timeframeText} of daily price data. More volatility means more risk, but also potential for higher returns.</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getReturnMetricsInterpretation(periodReturn, cagr, annualizedReturn, tokenName, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content return-interpretation';
        
        const periodReturnPct = (periodReturn * 100).toFixed(2);
        const cagrPct = (cagr * 100).toFixed(2);
        const annualizedReturnPct = (annualizedReturn * 100).toFixed(2);
        
        let mainInterpretation = '';
        if (periodReturn > 0.50) {
            mainInterpretation = `Strong returns over ${timeframeText}. ${tokenName} delivered a ${periodReturnPct}% total return during this period.`;
        } else if (periodReturn > 0.20) {
            mainInterpretation = `Positive returns over ${timeframeText}. ${tokenName} gained ${periodReturnPct}% during this period.`;
        } else if (periodReturn > 0) {
            mainInterpretation = `Modest positive returns over ${timeframeText}. ${tokenName} gained ${periodReturnPct}% during this period.`;
        } else if (periodReturn > -0.20) {
            mainInterpretation = `Negative returns over ${timeframeText}. ${tokenName} lost ${Math.abs(parseFloat(periodReturnPct))}% during this period.`;
        } else {
            mainInterpretation = `Significant losses over ${timeframeText}. ${tokenName} declined ${Math.abs(parseFloat(periodReturnPct))}% during this period.`;
        }
        
        // Add explanation for why these differ
        let whyDifferentNote = '';
        if (timeframeText === '1 year' && Math.abs(parseFloat(periodReturnPct) - parseFloat(annualizedReturnPct)) > 1) {
            whyDifferentNote = `<p class="context-note"><strong>Why do these differ for ${timeframeText}?</strong> Period Return and CAGR show the <em>actual</em> price change (${periodReturnPct}%), while Annualized Return (${annualizedReturnPct}%) shows the <em>average daily return × 252</em>. The difference comes from "volatility drag"—when prices swing up and down, the arithmetic mean of daily returns doesn't equal the geometric return. Higher volatility = bigger gap between these numbers.</p>`;
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Return Metrics:</strong> Three ways to measure performance over ${timeframeText}
            </div>
            <p class="interpretation-text">${mainInterpretation}</p>
            ${whyDifferentNote}
            <div class="interpretation-details">
                <p><strong>1. Period Return (${periodReturnPct}%):</strong> The simplest measure—total return from start to end. If you invested $100 at the beginning, you'd have $${(100 * (1 + periodReturn)).toFixed(2)} at the end.</p>
                <p><strong>2. CAGR (${cagrPct}%):</strong> Compound Annual Growth Rate—the smoothed annual return if growth was consistent each year. For ${timeframeText}, CAGR equals Period Return since it's exactly one year.</p>
                <p><strong>Formula:</strong> ((Ending Price ÷ Starting Price)^(1 ÷ Years)) - 1</p>
                <p><strong>3. Annualized Return (${annualizedReturnPct}%):</strong> <em>Arithmetic mean</em> of daily returns × 252 trading days. This is used in Sharpe/Sortino calculations but differs from CAGR because it's averaging daily % changes, not measuring actual geometric growth. The gap widens with higher volatility.</p>
                <p><strong>Which to Use?</strong> Period Return & CAGR for actual performance, Annualized Return (arithmetic) for academic risk-adjusted metrics.</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getSharpeInterpretation(sharpeRatio, tokenName, returnPct, volatilityPct, riskFreeRate, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content';
        
        let interpretation = '';
        let interpretationClass = '';
        const excessReturn = (parseFloat(returnPct) - riskFreeRate).toFixed(2);
        
        if (sharpeRatio > 2) {
            interpretation = `Excellent risk-adjusted performance. ${tokenName} is generating returns that significantly exceed the risk-free rate (${riskFreeRate.toFixed(2)}%) while maintaining reasonable volatility. This indicates strong risk management and efficient return generation.`;
            interpretationClass = 'excellent';
        } else if (sharpeRatio > 1) {
            interpretation = `Good risk-adjusted returns. ${tokenName} is providing solid returns above the risk-free rate (${riskFreeRate.toFixed(2)}%) relative to its volatility. The asset compensates investors well for the risk taken.`;
            interpretationClass = 'good';
        } else if (sharpeRatio > 0) {
            interpretation = `Moderate risk-adjusted performance. ${tokenName} is generating positive returns above the risk-free rate (${riskFreeRate.toFixed(2)}%), but the returns are modest relative to the volatility. Consider whether the risk is justified by the returns.`;
            interpretationClass = 'moderate';
        } else if (sharpeRatio > -1) {
            interpretation = `Poor risk-adjusted returns. ${tokenName} is underperforming the risk-free rate (${riskFreeRate.toFixed(2)}%). With an annualized return of ${returnPct}% and volatility of ${volatilityPct}%, you would have been better off investing in a safe Treasury bond during this period.`;
            interpretationClass = 'poor';
        } else {
            interpretation = `Very poor risk-adjusted performance. ${tokenName} has significantly underperformed the risk-free rate (${riskFreeRate.toFixed(2)}%) with high volatility (${volatilityPct}%). The negative return of ${returnPct}% combined with high volatility makes this a very inefficient investment during this timeframe.`;
            interpretationClass = 'very-poor';
        }
        
        // Add context for low Sharpe ratios when returns are poor
        let contextNote = '';
        if (sharpeRatio < 0.3 && sharpeRatio > 0) {
            contextNote = `<p class="context-note"><strong>Why is this Sharpe ratio low?</strong> Over ${timeframeText}, ${tokenName} only delivered ${excessReturn}% excess return above risk-free Treasury bonds, while experiencing ${volatilityPct}% volatility. The low Sharpe ratio (${sharpeRatio.toFixed(3)}) reflects that ${tokenName} took on significant risk but generated minimal reward during this specific period. Longer timeframes may show different results.</p>`;
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Sharpe Ratio:</strong> Return per unit of total risk
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            ${contextNote}
            <div class="interpretation-details">
                <p><strong>Formula:</strong> (Return - Risk-Free Rate) ÷ Volatility = (${returnPct}% - ${riskFreeRate.toFixed(2)}%) ÷ ${volatilityPct}% = <strong>${sharpeRatio.toFixed(3)}</strong></p>
                <p><strong>Key Insight:</strong> ${sharpeRatio > 1 ? 'Earning more than 1% extra return for each 1% of risk taken.' : sharpeRatio > 0 ? 'Positive excess return, but not keeping pace with risk.' : 'Losing money while taking risk. Treasury bonds would be better.'}</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getMaxDrawdownInterpretation(maxDrawdown, tokenName, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content maxdd-interpretation';
        
        const mddPct = (maxDrawdown * 100).toFixed(2);
        let interpretation = '';
        let interpretationClass = '';
        
        if (maxDrawdown < 0.05) {
            interpretation = `Excellent downside protection. Over ${timeframeText}, ${tokenName} experienced a maximum peak-to-trough loss of only ${mddPct}%. This indicates strong price stability and minimal drawdown risk during this period.`;
            interpretationClass = 'excellent';
        } else if (maxDrawdown < 0.15) {
            interpretation = `Good risk management. During ${timeframeText}, ${tokenName} had a maximum drawdown of ${mddPct}%. This is a reasonable level of downside risk for a cryptocurrency, showing the asset maintained relative stability during the worst market conditions.`;
            interpretationClass = 'good';
        } else if (maxDrawdown < 0.30) {
            interpretation = `Moderate drawdown risk. Over ${timeframeText}, ${tokenName} experienced a ${mddPct}% peak-to-trough decline. This is typical for crypto assets and represents a significant but manageable level of risk during this period.`;
            interpretationClass = 'moderate';
        } else if (maxDrawdown < 0.50) {
            interpretation = `High drawdown risk. During ${timeframeText}, ${tokenName} suffered a ${mddPct}% peak-to-trough loss. This represents substantial downside risk and requires a high risk tolerance.`;
            interpretationClass = 'poor';
        } else {
            interpretation = `Very high drawdown risk. Over ${timeframeText}, ${tokenName} experienced a severe ${mddPct}% peak-to-trough decline. This extreme drawdown level indicates very high risk and volatility during this period.`;
            interpretationClass = 'very-poor';
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Maximum Drawdown:</strong> Largest peak-to-trough loss during ${timeframeText}
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>What It Shows:</strong> This measures the largest percentage drop from a peak price to a subsequent trough during ${timeframeText}. If you bought ${tokenName} at the absolute worst time (the peak), you'd have lost <strong>${mddPct}%</strong> at the low point before any recovery.</p>
                <p><strong>To Recover:</strong> From that low point, the asset needs to gain <strong>${(100 * maxDrawdown / (1 - maxDrawdown)).toFixed(2)}%</strong> to break even. ${maxDrawdown < 0.20 ? 'Quick recovery possible.' : maxDrawdown < 0.50 ? 'Long recovery period likely.' : 'Very long recovery ahead.'}</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getSortinoInterpretation(sortinoRatio, tokenName, returnPct, downsideVolPct, riskFreeRate, sharpeRatio, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content sortino-interpretation';
        
        let interpretation = '';
        let interpretationClass = '';
        
        // Handle infinite/very high Sortino (no downside volatility)
        if (sortinoRatio >= 999) {
            interpretation = `Exceptional downside protection. During ${timeframeText}, ${tokenName} had no negative returns, meaning perfect downside risk management. The Sortino Ratio is extremely high, indicating the asset only moved upward relative to the risk-free rate.`;
            interpretationClass = 'excellent';
        } else if (sortinoRatio > 2) {
            interpretation = `Excellent downside risk management. Over ${timeframeText}, ${tokenName} generated strong returns while experiencing minimal downside volatility (${downsideVolPct}%). This indicates the asset protected well against losses during this period while delivering returns above the risk-free rate.`;
            interpretationClass = 'excellent';
        } else if (sortinoRatio > 1) {
            interpretation = `Good downside protection. During ${timeframeText}, ${tokenName} showed decent returns relative to its downside volatility (${downsideVolPct}%). The asset managed downside risk reasonably well while generating excess returns.`;
            interpretationClass = 'good';
        } else if (sortinoRatio > 0) {
            interpretation = `Moderate downside risk. Over ${timeframeText}, ${tokenName} had positive returns but experienced significant downside volatility (${downsideVolPct}%). While returns exceeded the risk-free rate, the asset had notable downside risk exposure during this period.`;
            interpretationClass = 'moderate';
        } else {
            interpretation = `Poor downside risk management. During ${timeframeText}, ${tokenName} had negative returns with high downside volatility (${downsideVolPct}%). The asset underperformed the risk-free rate and experienced significant downside movements during this period.`;
            interpretationClass = 'poor';
        }
        
        const sortinoDisplay = sortinoRatio >= 999 ? '∞' : sortinoRatio.toFixed(3);
        const comparisonNote = sortinoRatio > sharpeRatio ? 'The Sortino Ratio is higher than the Sharpe Ratio, indicating the asset has more upside volatility than downside volatility.' : 'The asset experiences significant downside risk relative to its returns.';
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Sortino Ratio:</strong> Return per unit of downside risk over ${timeframeText}
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Why It Matters:</strong> Only penalizes bad volatility (losses), not upside gains. Better for crypto than Sharpe. Calculated from ${timeframeText} of daily returns, focusing only on days with negative returns.</p>
                <p><strong>Formula:</strong> (Return - Risk-Free Rate) ÷ Downside Volatility = <strong>${sortinoDisplay}</strong></p>
                <p><strong>Comparison:</strong> ${comparisonNote}</p>
            </div>
        `;
        
        return interpretationDiv;
    }

    function getCorrelationInterpretation(correlationToSP500, correlationToBitcoin, tokenName, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content correlation-interpretation';
        
        let content = `<div class="interpretation-header"><strong>Correlations:</strong> How ${tokenName} moved with other assets over ${timeframeText}</div>`;
        
        // S&P 500 Correlation
        if (correlationToSP500 !== null) {
            const corrValue = correlationToSP500;
            let sp500Text = '';
            let sp500Class = '';
            
            if (Math.abs(corrValue) < 0.3) {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> — Moves independently from stocks. Great diversification.`;
                sp500Class = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> — Some relationship with stocks. Good diversification.`;
                sp500Class = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> — Tends to move with stocks. Limited diversification.`;
                sp500Class = 'moderate';
            } else {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> — Moves closely with stocks. Minimal diversification.`;
                sp500Class = 'poor';
            }
            
            content += `<p class="interpretation-text ${sp500Class}"><strong>vs S&P 500:</strong> ${sp500Text}</p>`;
        }
        
        // Bitcoin Correlation
        if (correlationToBitcoin !== null) {
            const corrValue = correlationToBitcoin;
            let btcText = '';
            let btcClass = '';
            
            if (Math.abs(corrValue) < 0.3) {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> — Independent from Bitcoin. Unique price drivers.`;
                btcClass = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> — Some Bitcoin influence. Maintains independence.`;
                btcClass = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> — Follows Bitcoin trends closely.`;
                btcClass = 'moderate';
            } else {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> — Highly dependent on Bitcoin price action.`;
                btcClass = 'poor';
            }
            
            content += `<p class="interpretation-text ${btcClass}"><strong>vs Bitcoin:</strong> ${btcText}</p>`;
        }
        
        // Add details section
        content += `
            <div class="interpretation-details">
                <p><strong>Scale:</strong> -1 (opposite moves) → 0 (independent) → +1 (moves together)</p>
                <p><strong>Calculated From:</strong> Daily price movements over ${timeframeText}. Measures how consistently ${tokenName} moved in the same direction as the compared asset.</p>
                <p><strong>For Portfolios:</strong> Lower correlation = better diversification and risk reduction.</p>
            </div>
        `;
        
        interpretationDiv.innerHTML = content;
        return interpretationDiv;
    }

    function createMetricsTable(tokenResults, timeframeText) {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'metrics-table-wrapper';
        
        let tableHTML = `
            <p class="table-context">Comprehensive metrics comparison for ${timeframeText}</p>
            <div class="metrics-table">
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            ${tokenResults.map(t => `<th>${t.id.toUpperCase()}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="metric-name">Period Return</td>
                            ${tokenResults.map(t => `<td class="metric-value">${(t.periodReturn * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">CAGR</td>
                            ${tokenResults.map(t => `<td class="metric-value">${(t.cagr * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Annualized Return</td>
                            ${tokenResults.map(t => `<td class="metric-value">${(t.annualizedReturn * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Volatility</td>
                            ${tokenResults.map(t => `<td class="metric-value">${(t.volatility * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Max Drawdown</td>
                            ${tokenResults.map(t => {
                                const mdd = (t.maxDrawdown * 100).toFixed(2);
                                return `<td class="metric-value">${t.maxDrawdown > 0 ? `-${mdd}` : mdd}%</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Sharpe Ratio</td>
                            ${tokenResults.map(t => `<td class="metric-value">${t.sharpeRatio.toFixed(3)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Sortino Ratio</td>
                            ${tokenResults.map(t => `<td class="metric-value">${t.sortinoRatio >= 999 ? '∞' : t.sortinoRatio.toFixed(3)}</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Downside Volatility</td>
                            ${tokenResults.map(t => `<td class="metric-value">${(t.downsideVolatility * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Correlation to S&P 500</td>
                            ${tokenResults.map(t => `<td class="metric-value">${t.correlationToSP500 !== null ? t.correlationToSP500.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                        <tr>
                            <td class="metric-name">Correlation to Bitcoin</td>
                            ${tokenResults.map(t => `<td class="metric-value">${t.correlationToBitcoin !== null ? t.correlationToBitcoin.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        tableWrapper.innerHTML = tableHTML;
        return tableWrapper;
    }

    function createWinnerSection(tokenResults, riskFreeRate, timeframeDays) {
        // Sort tokens by Sharpe ratio (primary) and Sortino ratio (secondary)
        const sortedTokens = [...tokenResults].sort((a, b) => {
            if (Math.abs(a.sharpeRatio - b.sharpeRatio) > 0.01) {
                return b.sharpeRatio - a.sharpeRatio;
            }
            return b.sortinoRatio - a.sortinoRatio;
        });

        const winner = sortedTokens[0];
        const winnerName = winner.id.toUpperCase();
        const timeframeText = getTimeframeText(timeframeDays);
        
        // Format all metrics for winner
        const winnerReturn = (winner.meanReturn * 100).toFixed(2);
        const winnerVol = (winner.volatility * 100).toFixed(2);
        const winnerMDD = (winner.maxDrawdown * 100).toFixed(2);
        const winnerMDDDisplay = winner.maxDrawdown > 0 ? `-${winnerMDD}` : winnerMDD;
        const winnerSharpe = winner.sharpeRatio.toFixed(3);
        const winnerSortino = winner.sortinoRatio >= 999 ? '∞' : winner.sortinoRatio.toFixed(3);

        // Format price data (with fallbacks for backwards compatibility)
        const winnerLow = winner.lowPrice ? winner.lowPrice.toFixed(2) : 'N/A';
        const winnerHigh = winner.highPrice ? winner.highPrice.toFixed(2) : 'N/A';
        const winnerCurrent = winner.currentPrice ? winner.currentPrice.toFixed(2) : 'N/A';

        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'winner higher';
        winnerDiv.innerHTML = `
            <div class="winner-header">🏆 <strong>${winnerName}</strong> shows the best overall risk-adjusted performance over ${timeframeText}</div>
            <div class="winner-price-range">
                <span class="price-label">Price Range:</span> 
                <span class="price-value">$${winnerLow} <span class="range-arrow">→</span> $${winnerHigh}</span>
                <span class="price-context">(Current: $${winnerCurrent})</span>
            </div>
            <div class="winner-metrics">
                <div class="winner-metric-row">
                    <span class="metric-label">Return:</span> <span class="metric-value">${winnerReturn}%</span>
                    <span class="metric-label">Std Deviation (σ):</span> <span class="metric-value">${winnerVol}% <span class="metric-sublabel">annualized</span></span>
                    <span class="metric-label">Max Drawdown:</span> <span class="metric-value">${winnerMDDDisplay}%</span>
                </div>
                <div class="winner-metric-row">
                    <span class="metric-label">Sharpe Ratio:</span> <span class="metric-value">${winnerSharpe}</span>
                    <span class="metric-label">Sortino Ratio:</span> <span class="metric-value">${winnerSortino}</span>
                </div>
            </div>
        `;
        
        // Add comparison text for multiple tokens
        if (sortedTokens.length === 2) {
            const second = sortedTokens[1];
            const secondName = second.id.toUpperCase();
            const secondReturn = (second.meanReturn * 100).toFixed(2);
            const secondMDD = (second.maxDrawdown * 100).toFixed(2);
            
            const returnDiff = Math.abs(parseFloat(winnerReturn) - parseFloat(secondReturn)).toFixed(2);
            const mddDiff = Math.abs(parseFloat(winnerMDD) - parseFloat(secondMDD)).toFixed(2);
            
            let comparisonText = `<div class="winner-comparison">Compared to ${secondName}: `;
            
            if (parseFloat(winnerReturn) > parseFloat(secondReturn)) {
                comparisonText += `${returnDiff}% higher return, `;
            } else if (parseFloat(winnerReturn) < parseFloat(secondReturn)) {
                comparisonText += `${returnDiff}% lower return but `;
            }
            
            if (parseFloat(winnerMDD) < parseFloat(secondMDD)) {
                comparisonText += `${mddDiff}% smaller max drawdown`;
            } else {
                comparisonText += `${mddDiff}% larger max drawdown`;
            }
            
            comparisonText += ', and superior risk-adjusted metrics (Sharpe & Sortino).</div>';
            winnerDiv.innerHTML += comparisonText;
        } else if (sortedTokens.length > 2) {
            winnerDiv.innerHTML += `<div class="winner-comparison">Outperforms ${sortedTokens.length - 1} other assets based on risk-adjusted return metrics.</div>`;
        }

        return winnerDiv;
    }

    function createRiskFreeRateSection(riskFreeRate) {
        const rateDiv = document.createElement('div');
        rateDiv.className = 'risk-free-rate-section';
        
        rateDiv.innerHTML = `
            <div class="risk-free-rate-content">
                <div class="risk-free-rate-label">
                    <strong>Risk-Free Rate:</strong> <span class="rate-value">${riskFreeRate.toFixed(2)}%</span>
                </div>
                <div class="risk-free-rate-explanation">
                    Based on the current 10-Year U.S. Treasury yield from the Federal Reserve. This represents the baseline return for a risk-free investment and is used in Sharpe and Sortino ratio calculations to measure excess returns above this safe benchmark.
                </div>
            </div>
        `;
        
        return rateDiv;
    }

    function getTimeframeText(days) {
        if (days === 30) return '30 days';
        if (days === 90) return '90 days';
        if (days === 365) return '1 year';
        if (days === 1095) return '3 years';
        if (days === 1825) return '5 years';
        if (days === 3650) return '10 years';
        return `${days} days`;
    }

    function createSummarySection(tokenResults, riskFreeRate, timeframeDays) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-section';
        
        const timeframeText = getTimeframeText(timeframeDays);
        
        let summaryHTML = `
            <h3 class="summary-title">Quick Overview</h3>
            <p class="overview-context">Analysis period: <strong>${timeframeText}</strong> | Risk-adjusted returns compared to ${riskFreeRate.toFixed(2)}% risk-free rate | Max Drawdown shows peak-to-trough loss during this period</p>
            <p class="tap-hint">💡 Tap any asset card to jump to its detailed analysis</p>
            <div class="summary-cards">
        `;
        
        tokenResults.forEach(tokenData => {
            const tokenName = tokenData.id.toUpperCase();
            const tokenId = tokenData.id.toLowerCase();
            const returnPct = (tokenData.periodReturn * 100).toFixed(2); // Use period return for quick overview
            const sharpe = tokenData.sharpeRatio.toFixed(2);
            const mdd = (tokenData.maxDrawdown * 100).toFixed(2);
            const mddDisplay = tokenData.maxDrawdown > 0 ? `-${mdd}` : mdd;
            
            // Format price data (with fallbacks for backwards compatibility)
            const lowPrice = tokenData.lowPrice ? tokenData.lowPrice.toFixed(2) : 'N/A';
            const highPrice = tokenData.highPrice ? tokenData.highPrice.toFixed(2) : 'N/A';
            
            const performanceClass = tokenData.sharpeRatio > 1 ? 'excellent' : tokenData.sharpeRatio > 0 ? 'good' : 'poor';
            
            summaryHTML += `
                <div class="summary-card ${performanceClass} clickable" data-token="${tokenId}" role="button" tabindex="0" aria-label="View detailed analysis for ${tokenName}">
                    <h4>${tokenName}</h4>
                    <div class="price-range-summary">
                        <span class="range-label">${timeframeText} Range:</span>
                        <span class="range-value">$${lowPrice} - $${highPrice}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Period Return</span>
                        <span class="summary-value">${returnPct}%</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Sharpe Ratio</span>
                        <span class="summary-value">${sharpe}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Max Drawdown</span>
                        <span class="summary-value">${mddDisplay}%</span>
                    </div>
                    <div class="card-tooltip">👆 Click for detailed analysis</div>
                </div>
            `;
        });
        
        summaryHTML += '</div>';
        summaryDiv.innerHTML = summaryHTML;
        
        // Add click handlers to summary cards
        setTimeout(() => {
            const cards = summaryDiv.querySelectorAll('.summary-card.clickable');
            cards.forEach(card => {
                const clickHandler = () => {
                    const tokenId = card.dataset.token;
                    const targetCard = document.querySelector(`.asset-interpretation-card[data-token="${tokenId}"]`);
                    if (targetCard) {
                        // Smooth scroll to the detailed analysis card
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Expand if collapsed
                        const content = targetCard.querySelector('.asset-card-content');
                        if (content && content.classList.contains('collapsed')) {
                            const expandBtn = targetCard.querySelector('.expand-asset-btn');
                            if (expandBtn) expandBtn.click();
                        }
                        // Add highlight animation
                        targetCard.classList.add('highlighted');
                        setTimeout(() => targetCard.classList.remove('highlighted'), 2000);
                    }
                };
                
                card.addEventListener('click', clickHandler);
                card.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        clickHandler();
                    }
                });
            });
        }, 100);
        
        return summaryDiv;
    }

    function displayResults(data) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        
        // Display risk-free rate
        document.getElementById('riskFreeRate').textContent = `${data.riskFreeRate.toFixed(2)}%`;

        // Get all token results and timeframe
        const tokenResults = data.tokens || [];
        const timeframeDays = data.timeframe || 365;
        const isSingle = tokenResults.length === 1;
        const isMultiple = tokenResults.length > 1;

        // STEP 1: Show winner/conclusion first (if multiple tokens)
        if (isMultiple) {
            const winnerSection = createWinnerSection(tokenResults, data.riskFreeRate, timeframeDays);
            resultsContainer.appendChild(winnerSection);
        }

        // STEP 2: Show risk-free rate info
        const riskFreeRateSection = createRiskFreeRateSection(data.riskFreeRate);
        resultsContainer.appendChild(riskFreeRateSection);

        // STEP 3: Show summary stats for all tokens
        const summarySection = createSummarySection(tokenResults, data.riskFreeRate, timeframeDays);
        resultsContainer.appendChild(summarySection);

        // STEP 4: Create detailed breakdown section (collapsible)
        const detailedSection = document.createElement('div');
        detailedSection.className = 'detailed-section';
        detailedSection.innerHTML = `
            <div class="detailed-header">
                <h3>Detailed Analysis</h3>
                <button class="toggle-details-btn" id="toggleDetailsBtn">
                    <span class="toggle-text">Hide Details</span>
                    <span class="toggle-icon">▲</span>
                </button>
            </div>
            <div class="detailed-content" id="detailedContent">
            </div>
        `;
        resultsContainer.appendChild(detailedSection);

        const detailedContent = detailedSection.querySelector('#detailedContent');
        const timeframeText = getTimeframeText(timeframeDays);

        // STEP 1: Create metrics comparison table
        const tableSection = createMetricsTable(tokenResults, timeframeText);
        detailedContent.appendChild(tableSection);

        // STEP 2: Create expandable interpretation sections for each token
        const interpretationsSection = document.createElement('div');
        interpretationsSection.className = 'interpretations-section';
        
        const interpretationsTitle = document.createElement('h4');
        interpretationsTitle.textContent = 'Detailed Written Analysis';
        interpretationsTitle.style.cssText = 'margin-top: 32px; margin-bottom: 16px; color: var(--text-primary); text-align: center;';
        interpretationsSection.appendChild(interpretationsTitle);
        
        tokenResults.forEach((tokenData, index) => {
            const tokenName = tokenData.id.toUpperCase();
            const annualizedReturnPct = (tokenData.annualizedReturn * 100).toFixed(2);
            const volatilityPct = (tokenData.volatility * 100).toFixed(2);
            const downsideVolPct = (tokenData.downsideVolatility * 100).toFixed(2);

            // Create expandable card for this asset
            const assetCard = document.createElement('div');
            assetCard.className = 'asset-interpretation-card';
            assetCard.dataset.token = tokenData.id.toLowerCase();
            
            assetCard.innerHTML = `
                <div class="asset-card-header" data-asset-index="${index}">
                    <h4>${tokenName}</h4>
                    <button class="expand-asset-btn">
                        <span class="expand-text">Expand Analysis</span>
                        <span class="expand-icon">▼</span>
                    </button>
                </div>
                <div class="asset-card-content collapsed" id="assetContent${index}">
                    <p class="interpretation-intro">Detailed written analysis for ${tokenName} over ${timeframeText}</p>
                </div>
            `;

            interpretationsSection.appendChild(assetCard);

            // Add interpretations to the content area
            const contentArea = assetCard.querySelector(`#assetContent${index}`);
            
            // Return metrics interpretation
            contentArea.appendChild(getReturnMetricsInterpretation(
                tokenData.periodReturn,
                tokenData.cagr,
                tokenData.annualizedReturn,
                tokenName,
                timeframeText
            ));
            
            // Volatility interpretation
            contentArea.appendChild(getVolatilityInterpretation(
                tokenData.volatility,
                tokenName,
                volatilityPct,
                timeframeText
            ));
            
            // Sharpe interpretation
            contentArea.appendChild(getSharpeInterpretation(
                tokenData.sharpeRatio,
                tokenName,
                annualizedReturnPct,
                volatilityPct,
                data.riskFreeRate,
                timeframeText
            ));
            
            // Maximum Drawdown interpretation
            contentArea.appendChild(getMaxDrawdownInterpretation(
                tokenData.maxDrawdown,
                tokenName,
                timeframeText
            ));
            
            // Sortino interpretation
            contentArea.appendChild(getSortinoInterpretation(
                tokenData.sortinoRatio,
                tokenName,
                annualizedReturnPct,
                downsideVolPct,
                data.riskFreeRate,
                tokenData.sharpeRatio,
                timeframeText
            ));
            
            // Correlation interpretation (if data available)
            if ((tokenData.correlationToSP500 !== null && tokenData.correlationToSP500 !== undefined) || 
                (tokenData.correlationToBitcoin !== null && tokenData.correlationToBitcoin !== undefined)) {
                contentArea.appendChild(getCorrelationInterpretation(
                    tokenData.correlationToSP500,
                    tokenData.correlationToBitcoin,
                    tokenName,
                    timeframeText
                ));
            }
            
            // Add click handler for expand/collapse
            const headerBtn = assetCard.querySelector('.expand-asset-btn');
            headerBtn.addEventListener('click', () => {
                contentArea.classList.toggle('collapsed');
                const isCollapsed = contentArea.classList.contains('collapsed');
                headerBtn.querySelector('.expand-text').textContent = isCollapsed ? 'Expand Analysis' : 'Collapse Analysis';
                headerBtn.querySelector('.expand-icon').textContent = isCollapsed ? '▼' : '▲';
            });
        });

        detailedContent.appendChild(interpretationsSection);

        // Add toggle functionality for detailed section
        const toggleBtn = document.getElementById('toggleDetailsBtn');
        const toggleText = toggleBtn.querySelector('.toggle-text');
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        
        toggleBtn.addEventListener('click', () => {
            detailedContent.classList.toggle('collapsed');
            const isCollapsed = detailedContent.classList.contains('collapsed');
            toggleText.textContent = isCollapsed ? 'Show Details' : 'Hide Details';
            toggleIcon.textContent = isCollapsed ? '▼' : '▲';
        });

        // Show results
        results.classList.remove('hidden');
        
        // Auto-scroll to results after a brief delay to allow rendering
        setTimeout(() => {
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    // Initialize with default example tokens
    function initializeDefaultTokens() {
        // Get first token input and set to bitcoin
        const firstInput = document.getElementById('token0');
        if (firstInput) {
            firstInput.value = 'bitcoin';
        }

        // Add ethereum as second token (don't focus to prevent scroll)
        addTokenInput(false);
        const secondInput = document.getElementById('token1');
        if (secondInput) {
            secondInput.value = 'ethereum';
        }

        // Add zcash as third token (don't focus to prevent scroll)
        addTokenInput(false);
        const thirdInput = document.getElementById('token2');
        if (thirdInput) {
            thirdInput.value = 'zcash';
        }
    }

    // Initialize defaults on page load
    initializeDefaultTokens();

    // Ensure page starts at the top - more robust approach
    // Immediate scroll
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    
    // Force scroll after DOM is fully loaded
    if (document.readyState === 'complete') {
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
    }
    
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    });
    
    // Final fallback after short delay
    setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, 100);

    // Make tooltip work on click/tap for mobile devices
    const tooltipElement = document.getElementById('riskFreeTooltip');
    const tooltipText = document.getElementById('tooltipText');
    
    if (tooltipElement && tooltipText) {
        let tooltipVisible = false;
        
        tooltipElement.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltipVisible = !tooltipVisible;
            
            if (tooltipVisible) {
                tooltipText.classList.add('visible');
            } else {
                tooltipText.classList.remove('visible');
            }
        });
        
        // Close tooltip when clicking outside
        document.addEventListener('click', () => {
            if (tooltipVisible) {
                tooltipVisible = false;
                tooltipText.classList.remove('visible');
            }
        });
    }
});
