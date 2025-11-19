document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('analysisForm');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const tokensContainer = document.getElementById('tokensContainer');
    const addTokenBtn = document.getElementById('addTokenBtn');
    
    let tokenIndex = 1; // Start at 1 since we already have token0

    // Function to add a new token input
    function addTokenInput() {
        const tokenGroups = tokensContainer.querySelectorAll('.token-input-group');
        
        // Limit to 3 tokens maximum
        if (tokenGroups.length >= 3) {
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
        
        // Update add button visibility (max 3 tokens)
        if (tokenGroups.length >= 3) {
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

    function getSharpeInterpretation(sharpeRatio, tokenName, returnPct, volatilityPct, riskFreeRate) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content';
        
        let interpretation = '';
        let interpretationClass = '';
        
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
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>What this means:</strong>
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Calculation:</strong> Sharpe Ratio = (${returnPct}% - ${riskFreeRate.toFixed(2)}%) / ${volatilityPct}% = ${sharpeRatio.toFixed(3)}</p>
                <p><strong>Interpretation:</strong> ${sharpeRatio > 1 ? 'Good' : sharpeRatio > 0 ? 'Moderate' : 'Poor'} risk-adjusted returns. ${sharpeRatio > 0 ? 'The asset is generating excess returns above the risk-free rate.' : 'The asset is underperforming the risk-free rate, meaning a Treasury bond would have been a better choice.'}</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getMaxDrawdownInterpretation(maxDrawdown, tokenName) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content maxdd-interpretation';
        
        const mddPct = (maxDrawdown * 100).toFixed(2);
        let interpretation = '';
        let interpretationClass = '';
        
        if (maxDrawdown < 0.05) {
            interpretation = `Excellent downside protection. ${tokenName} experienced a maximum peak-to-trough loss of only ${mddPct}% during this period. This indicates strong price stability and minimal drawdown risk, making it suitable for risk-averse investors.`;
            interpretationClass = 'excellent';
        } else if (maxDrawdown < 0.15) {
            interpretation = `Good risk management. ${tokenName} had a maximum drawdown of ${mddPct}%. This is a reasonable level of downside risk for a cryptocurrency, showing the asset maintained relative stability during the worst market conditions.`;
            interpretationClass = 'good';
        } else if (maxDrawdown < 0.30) {
            interpretation = `Moderate drawdown risk. ${tokenName} experienced a ${mddPct}% peak-to-trough decline. This is typical for crypto assets and represents a significant but manageable level of risk. Investors should be comfortable with this magnitude of drawdowns.`;
            interpretationClass = 'moderate';
        } else if (maxDrawdown < 0.50) {
            interpretation = `High drawdown risk. ${tokenName} suffered a ${mddPct}% peak-to-trough loss. This represents substantial downside risk and requires a high risk tolerance. Investors need strong conviction to hold through such drawdowns.`;
            interpretationClass = 'poor';
        } else {
            interpretation = `Very high drawdown risk. ${tokenName} experienced a severe ${mddPct}% peak-to-trough decline. This extreme drawdown level indicates very high risk and volatility. Only investors with exceptional risk tolerance should consider this asset.`;
            interpretationClass = 'very-poor';
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Maximum Drawdown (Peak Loss):</strong>
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>What It Measures:</strong> Maximum Drawdown shows the largest peak-to-trough decline in value during the period. It represents the worst loss an investor would have experienced if they bought at the peak and held through to the lowest point.</p>
                <p><strong>Interpretation:</strong> ${maxDrawdown < 0.15 ? 'Low' : maxDrawdown < 0.30 ? 'Moderate' : maxDrawdown < 0.50 ? 'High' : 'Very High'} drawdown risk. ${maxDrawdown < 0.20 ? 'The asset shows good stability with limited downside exposure.' : 'Investors should be prepared for significant temporary losses and have a long-term investment horizon.'}</p>
                <p><strong>Recovery Requirement:</strong> After a ${mddPct}% loss, the asset needs to gain ${(100 * maxDrawdown / (1 - maxDrawdown)).toFixed(2)}% to return to its previous peak.</p>
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getSortinoInterpretation(sortinoRatio, tokenName, returnPct, downsideVolPct, riskFreeRate, sharpeRatio) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content sortino-interpretation';
        
        let interpretation = '';
        let interpretationClass = '';
        
        // Handle infinite/very high Sortino (no downside volatility)
        if (sortinoRatio >= 999) {
            interpretation = `Exceptional downside protection. ${tokenName} had no negative returns during this period, meaning perfect downside risk management. The Sortino Ratio is extremely high, indicating the asset only moved upward relative to the risk-free rate.`;
            interpretationClass = 'excellent';
        } else if (sortinoRatio > 2) {
            interpretation = `Excellent downside risk management. ${tokenName} has a high Sortino Ratio, meaning it generates strong returns while experiencing minimal downside volatility (${downsideVolPct}%). This indicates the asset protects well against losses while delivering returns above the risk-free rate.`;
            interpretationClass = 'excellent';
        } else if (sortinoRatio > 1) {
            interpretation = `Good downside protection. ${tokenName} shows decent returns relative to its downside volatility (${downsideVolPct}%). The asset manages downside risk reasonably well while generating excess returns.`;
            interpretationClass = 'good';
        } else if (sortinoRatio > 0) {
            interpretation = `Moderate downside risk. ${tokenName} has positive returns but experiences significant downside volatility (${downsideVolPct}%). While returns exceed the risk-free rate, the asset has notable downside risk exposure.`;
            interpretationClass = 'moderate';
        } else {
            interpretation = `Poor downside risk management. ${tokenName} has negative returns with high downside volatility (${downsideVolPct}%). The asset is underperforming the risk-free rate and experiencing significant downside movements, making it a risky investment during this period.`;
            interpretationClass = 'poor';
        }
        
        const sortinoDisplay = sortinoRatio >= 999 ? '∞' : sortinoRatio.toFixed(3);
        const comparisonNote = sortinoRatio > sharpeRatio ? 'The Sortino Ratio is higher than the Sharpe Ratio, indicating the asset has more upside volatility than downside volatility.' : 'The asset experiences significant downside risk relative to its returns.';
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Sortino Ratio (Downside Risk Focus):</strong>
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Key Difference:</strong> Unlike Sharpe Ratio which penalizes all volatility, Sortino only penalizes downside volatility (negative returns). This makes it better for assets with asymmetric return distributions.</p>
                <p><strong>Calculation:</strong> Sortino Ratio = (${returnPct}% - ${riskFreeRate.toFixed(2)}%) / ${downsideVolPct}% = ${sortinoDisplay}</p>
                <p><strong>Interpretation:</strong> ${sortinoRatio >= 999 ? 'Perfect' : sortinoRatio > 1 ? 'Good' : sortinoRatio > 0 ? 'Moderate' : 'Poor'} downside protection. ${comparisonNote}</p>
            </div>
        `;
        
        return interpretationDiv;
    }

    function getCorrelationInterpretation(correlationToSP500, correlationToBitcoin, tokenName) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content correlation-interpretation';
        
        let content = '<div class="interpretation-header"><strong>Market Correlations:</strong></div>';
        
        // S&P 500 Correlation
        if (correlationToSP500 !== null) {
            const corrValue = correlationToSP500;
            let sp500Text = '';
            let sp500Class = '';
            
            if (Math.abs(corrValue) < 0.3) {
                sp500Text = `Low correlation (${corrValue.toFixed(2)}) to S&P 500. ${tokenName} moves largely independently from traditional stock markets, providing excellent diversification benefits for a traditional portfolio.`;
                sp500Class = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                sp500Text = `Moderate correlation (${corrValue.toFixed(2)}) to S&P 500. ${tokenName} shows some relationship with traditional markets but maintains significant independence, offering good diversification potential.`;
                sp500Class = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                sp500Text = `High correlation (${corrValue.toFixed(2)}) to S&P 500. ${tokenName} tends to move with traditional markets, reducing diversification benefits when added to a stock portfolio.`;
                sp500Class = 'moderate';
            } else {
                sp500Text = `Very high correlation (${corrValue.toFixed(2)}) to S&P 500. ${tokenName} moves very closely with traditional markets, offering minimal diversification benefits.`;
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
                btcText = `Low correlation (${corrValue.toFixed(2)}) to Bitcoin. ${tokenName} moves independently from Bitcoin, suggesting it has unique price drivers and isn't just following the crypto market leader.`;
                btcClass = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                btcText = `Moderate correlation (${corrValue.toFixed(2)}) to Bitcoin. ${tokenName} shows some relationship with Bitcoin but maintains meaningful independence in its price movements.`;
                btcClass = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                btcText = `High correlation (${corrValue.toFixed(2)}) to Bitcoin. ${tokenName} tends to move with Bitcoin, indicating it's significantly influenced by Bitcoin's price action.`;
                btcClass = 'moderate';
            } else {
                btcText = `Very high correlation (${corrValue.toFixed(2)}) to Bitcoin. ${tokenName} moves very closely with Bitcoin, suggesting it's heavily dependent on Bitcoin's price movements with little independent price action.`;
                btcClass = 'poor';
            }
            
            content += `<p class="interpretation-text ${btcClass}"><strong>vs Bitcoin:</strong> ${btcText}</p>`;
        }
        
        // Add details section
        content += `
            <div class="interpretation-details">
                <p><strong>Understanding Correlation:</strong></p>
                <p>Correlation ranges from -1 to +1:</p>
                <p>• <strong>+1</strong>: Perfect positive correlation (assets move together)</p>
                <p>• <strong>0</strong>: No correlation (independent movements)</p>
                <p>• <strong>-1</strong>: Perfect negative correlation (assets move opposite)</p>
                <p><strong>Portfolio Implication:</strong> Lower correlation to existing holdings provides better diversification and risk reduction benefits.</p>
            </div>
        `;
        
        interpretationDiv.innerHTML = content;
        return interpretationDiv;
    }

    function displayResults(data) {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = '';
        
        // Display risk-free rate
        document.getElementById('riskFreeRate').textContent = `${data.riskFreeRate.toFixed(2)}%`;

        // Get all token results
        const tokenResults = data.tokens || [];
        const isSingle = tokenResults.length === 1;
        const isMultiple = tokenResults.length > 1;

        // Create comparison container
        const comparisonDiv = document.createElement('div');
        comparisonDiv.className = `comparison ${isSingle ? 'single' : isMultiple ? 'multiple' : ''}`;

        // Create result cards for each token
        tokenResults.forEach((tokenData, index) => {
            // Add VS divider before second token if exactly 2 tokens
            if (tokenResults.length === 2 && index === 1) {
                const vsDivider = document.createElement('div');
                vsDivider.className = 'vs-divider';
                vsDivider.textContent = 'VS';
                comparisonDiv.appendChild(vsDivider);
            }
            const tokenName = tokenData.id.toUpperCase();
            const returnPct = (tokenData.meanReturn * 100).toFixed(2);
            const volatilityPct = (tokenData.volatility * 100).toFixed(2);
            const downsideVolPct = (tokenData.downsideVolatility * 100).toFixed(2);

            const maxDrawdownPct = (tokenData.maxDrawdown * 100).toFixed(2);

            const tokenResultDiv = document.createElement('div');
            tokenResultDiv.className = 'token-result';
            
            tokenResultDiv.innerHTML = `
                <h3>${tokenName}</h3>
                <div class="stat-box">
                    <div class="stat">
                        <span class="stat-label">Annualized Return</span>
                        <span class="stat-value">${returnPct}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Volatility</span>
                        <span class="stat-value">${volatilityPct}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Maximum Drawdown</span>
                        <span class="stat-value">${maxDrawdownPct}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Sharpe Ratio</span>
                        <span class="stat-value">${tokenData.sharpeRatio.toFixed(3)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Sortino Ratio</span>
                        <span class="stat-value">${tokenData.sortinoRatio >= 999 ? '∞' : tokenData.sortinoRatio.toFixed(3)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Downside Volatility</span>
                        <span class="stat-value">${downsideVolPct}%</span>
                    </div>
                    ${tokenData.correlationToSP500 !== null && tokenData.correlationToSP500 !== undefined ? `
                    <div class="stat">
                        <span class="stat-label">Correlation to S&P 500</span>
                        <span class="stat-value">${tokenData.correlationToSP500.toFixed(3)}</span>
                    </div>
                    ` : ''}
                    ${tokenData.correlationToBitcoin !== null && tokenData.correlationToBitcoin !== undefined ? `
                    <div class="stat">
                        <span class="stat-label">Correlation to Bitcoin</span>
                        <span class="stat-value">${tokenData.correlationToBitcoin.toFixed(3)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="interpretation" id="token${index}Interpretation"></div>
            `;

            comparisonDiv.appendChild(tokenResultDiv);

            // Add interpretations
            const interpretationDiv = tokenResultDiv.querySelector('.interpretation');
            
            // Sharpe interpretation
            interpretationDiv.appendChild(getSharpeInterpretation(
                tokenData.sharpeRatio,
                tokenName,
                returnPct,
                volatilityPct,
                data.riskFreeRate
            ));
            
            // Maximum Drawdown interpretation
            interpretationDiv.appendChild(getMaxDrawdownInterpretation(
                tokenData.maxDrawdown,
                tokenName
            ));
            
            // Sortino interpretation
            interpretationDiv.appendChild(getSortinoInterpretation(
                tokenData.sortinoRatio,
                tokenName,
                returnPct,
                downsideVolPct,
                data.riskFreeRate,
                tokenData.sharpeRatio
            ));
            
            // Correlation interpretation (if data available)
            if ((tokenData.correlationToSP500 !== null && tokenData.correlationToSP500 !== undefined) || 
                (tokenData.correlationToBitcoin !== null && tokenData.correlationToBitcoin !== undefined)) {
                interpretationDiv.appendChild(getCorrelationInterpretation(
                    tokenData.correlationToSP500,
                    tokenData.correlationToBitcoin,
                    tokenName
                ));
            }
        });

        resultsContainer.appendChild(comparisonDiv);

        // Determine winner (if multiple tokens)
        const winnerDiv = document.getElementById('winner');
        if (tokenResults.length > 1) {
            // Sort tokens by Sharpe ratio (primary) and Sortino ratio (secondary)
            const sortedTokens = [...tokenResults].sort((a, b) => {
                if (Math.abs(a.sharpeRatio - b.sharpeRatio) > 0.01) {
                    return b.sharpeRatio - a.sharpeRatio;
                }
                return b.sortinoRatio - a.sortinoRatio;
            });

            const winner = sortedTokens[0];
            const winnerName = winner.id.toUpperCase();
            
            // Format all metrics for winner
            const winnerReturn = (winner.meanReturn * 100).toFixed(2);
            const winnerVol = (winner.volatility * 100).toFixed(2);
            const winnerMDD = (winner.maxDrawdown * 100).toFixed(2);
            const winnerSharpe = winner.sharpeRatio.toFixed(3);
            const winnerSortino = winner.sortinoRatio >= 999 ? '∞' : winner.sortinoRatio.toFixed(3);

            // Create comprehensive comparison
            winnerDiv.innerHTML = `
                <div class="winner-header">🏆 <strong>${winnerName}</strong> shows the best overall risk-adjusted performance</div>
                <div class="winner-metrics">
                    <div class="winner-metric-row">
                        <span class="metric-label">Return:</span> <span class="metric-value">${winnerReturn}%</span>
                        <span class="metric-label">Volatility:</span> <span class="metric-value">${winnerVol}%</span>
                        <span class="metric-label">Max Drawdown:</span> <span class="metric-value">${winnerMDD}%</span>
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
            
            winnerDiv.className = 'winner higher';
        } else {
            winnerDiv.innerHTML = '';
            winnerDiv.className = '';
        }

        // Show results
        results.classList.remove('hidden');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
});
