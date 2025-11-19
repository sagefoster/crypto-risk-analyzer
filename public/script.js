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
        
        // Focus the newly created input to keep keyboard open on mobile
        // Use setTimeout to ensure DOM is fully updated
        setTimeout(() => {
            const newInput = tokenGroup.querySelector('.token-input');
            if (newInput) {
                newInput.focus();
            }
        }, 100);
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
                <strong>Sharpe Ratio:</strong> Return per unit of total risk
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Formula:</strong> (Return - Risk-Free Rate) ÷ Volatility = (${returnPct}% - ${riskFreeRate.toFixed(2)}%) ÷ ${volatilityPct}% = <strong>${sharpeRatio.toFixed(3)}</strong></p>
                <p><strong>Key Insight:</strong> ${sharpeRatio > 1 ? 'Earning more than 1% extra return for each 1% of risk taken.' : sharpeRatio > 0 ? 'Positive excess return, but not keeping pace with risk.' : 'Losing money while taking risk. Treasury bonds would be better.'}</p>
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
                <strong>Maximum Drawdown:</strong> Worst peak-to-trough loss
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>What It Shows:</strong> If you bought at the absolute worst time, you'd have lost <strong>${mddPct}%</strong> at the low point.</p>
                <p><strong>To Recover:</strong> Asset needs to gain <strong>${(100 * maxDrawdown / (1 - maxDrawdown)).toFixed(2)}%</strong> to break even. ${maxDrawdown < 0.20 ? 'Quick recovery possible.' : maxDrawdown < 0.50 ? 'Long recovery period likely.' : 'Very long recovery ahead.'}</p>
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
                <strong>Sortino Ratio:</strong> Return per unit of downside risk
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Why It Matters:</strong> Only penalizes bad volatility (losses), not upside gains. Better for crypto than Sharpe.</p>
                <p><strong>Formula:</strong> (Return - Risk-Free Rate) ÷ Downside Volatility = <strong>${sortinoDisplay}</strong></p>
                <p><strong>Comparison:</strong> ${comparisonNote}</p>
            </div>
        `;
        
        return interpretationDiv;
    }

    function getCorrelationInterpretation(correlationToSP500, correlationToBitcoin, tokenName) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content correlation-interpretation';
        
        let content = '<div class="interpretation-header"><strong>Correlations:</strong> How it moves with other assets</div>';
        
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
                <p><strong>For Portfolios:</strong> Lower correlation = better diversification and risk reduction.</p>
            </div>
        `;
        
        interpretationDiv.innerHTML = content;
        return interpretationDiv;
    }

    function createWinnerSection(tokenResults, riskFreeRate) {
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

        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'winner higher';
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

        return winnerDiv;
    }

    function createSummarySection(tokenResults, riskFreeRate) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-section';
        
        let summaryHTML = '<h3 class="summary-title">Quick Overview</h3><div class="summary-cards">';
        
        tokenResults.forEach(tokenData => {
            const tokenName = tokenData.id.toUpperCase();
            const returnPct = (tokenData.meanReturn * 100).toFixed(2);
            const sharpe = tokenData.sharpeRatio.toFixed(2);
            const mdd = (tokenData.maxDrawdown * 100).toFixed(2);
            
            const performanceClass = tokenData.sharpeRatio > 1 ? 'excellent' : tokenData.sharpeRatio > 0 ? 'good' : 'poor';
            
            summaryHTML += `
                <div class="summary-card ${performanceClass}">
                    <h4>${tokenName}</h4>
                    <div class="summary-stat">
                        <span class="summary-label">Return</span>
                        <span class="summary-value">${returnPct}%</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Sharpe Ratio</span>
                        <span class="summary-value">${sharpe}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Max Drawdown</span>
                        <span class="summary-value">${mdd}%</span>
                    </div>
                </div>
            `;
        });
        
        summaryHTML += '</div>';
        summaryDiv.innerHTML = summaryHTML;
        
        return summaryDiv;
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

        // STEP 1: Show winner/conclusion first (if multiple tokens)
        if (isMultiple) {
            const winnerSection = createWinnerSection(tokenResults, data.riskFreeRate);
            resultsContainer.appendChild(winnerSection);
        }

        // STEP 2: Show summary stats for all tokens
        const summarySection = createSummarySection(tokenResults, data.riskFreeRate);
        resultsContainer.appendChild(summarySection);

        // STEP 3: Create detailed breakdown section (collapsible)
        const detailedSection = document.createElement('div');
        detailedSection.className = 'detailed-section';
        detailedSection.innerHTML = `
            <div class="detailed-header">
                <h3>Detailed Analysis</h3>
                <button class="toggle-details-btn" id="toggleDetailsBtn">
                    <span class="toggle-text">Show Details</span>
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="detailed-content collapsed" id="detailedContent">
            </div>
        `;
        resultsContainer.appendChild(detailedSection);

        const detailedContent = detailedSection.querySelector('#detailedContent');

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
                <div class="stats-grid">
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

        detailedContent.appendChild(comparisonDiv);

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

        // Add ethereum as second token
        addTokenInput();
        const secondInput = document.getElementById('token1');
        if (secondInput) {
            secondInput.value = 'ethereum';
        }

        // Add zcash as third token
        addTokenInput();
        const thirdInput = document.getElementById('token2');
        if (thirdInput) {
            thirdInput.value = 'zcash';
        }
    }

    // Initialize defaults on page load
    initializeDefaultTokens();
});
