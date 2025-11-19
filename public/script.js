document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('analysisForm');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiKeyStatus = document.getElementById('apiKeyStatus');

    // Check if API key is configured on server
    try {
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        if (config.hasApiKey) {
            apiKeyStatus.textContent = '✓ API key configured - you can leave this field empty';
            apiKeyStatus.className = 'api-key-status configured';
        } else {
            apiKeyStatus.textContent = '⚠ No API key configured - please enter your API key';
            apiKeyStatus.className = 'api-key-status not-configured';
        }
    } catch (error) {
        console.error('Error checking API key config:', error);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous results and errors
        results.classList.add('hidden');
        errorDiv.classList.add('hidden');
        
        // Show loading
        loading.classList.remove('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';

        const apiKey = document.getElementById('apiKey').value.trim();
        const token1 = document.getElementById('token1').value.trim().toLowerCase();
        const token2 = document.getElementById('token2').value.trim().toLowerCase();
        const timeframe = document.getElementById('timeframe').value;

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey,
                    token1,
                    token2,
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

    function displayResults(data) {
        // Display risk-free rate
        document.getElementById('riskFreeRate').textContent = `${data.riskFreeRate.toFixed(2)}%`;

        // Calculate percentages for display
        const token1ReturnPct = (data.token1.meanReturn * 100).toFixed(2);
        const token1VolatilityPct = (data.token1.volatility * 100).toFixed(2);
        const token1DownsideVolPct = (data.token1.downsideVolatility * 100).toFixed(2);
        const token2ReturnPct = (data.token2.meanReturn * 100).toFixed(2);
        const token2VolatilityPct = (data.token2.volatility * 100).toFixed(2);
        const token2DownsideVolPct = (data.token2.downsideVolatility * 100).toFixed(2);

        // Display token 1 results
        const token1Name = data.token1.id.toUpperCase();
        document.getElementById('token1Name').textContent = token1Name;
        document.getElementById('token1Sharpe').textContent = data.token1.sharpeRatio.toFixed(3);
        document.getElementById('token1Sortino').textContent = data.token1.sortinoRatio >= 999 ? '∞' : data.token1.sortinoRatio.toFixed(3);
        document.getElementById('token1Return').textContent = `${token1ReturnPct}%`;
        document.getElementById('token1Volatility').textContent = `${token1VolatilityPct}%`;
        document.getElementById('token1DownsideVol').textContent = `${token1DownsideVolPct}%`;

        // Display token 2 results
        const token2Name = data.token2.id.toUpperCase();
        document.getElementById('token2Name').textContent = token2Name;
        document.getElementById('token2Sharpe').textContent = data.token2.sharpeRatio.toFixed(3);
        document.getElementById('token2Sortino').textContent = data.token2.sortinoRatio >= 999 ? '∞' : data.token2.sortinoRatio.toFixed(3);
        document.getElementById('token2Return').textContent = `${token2ReturnPct}%`;
        document.getElementById('token2Volatility').textContent = `${token2VolatilityPct}%`;
        document.getElementById('token2DownsideVol').textContent = `${token2DownsideVolPct}%`;

        // Add contextual interpretations
        const token1InterpretationDiv = document.getElementById('token1Interpretation');
        token1InterpretationDiv.innerHTML = '';
        
        // Sharpe interpretation
        token1InterpretationDiv.appendChild(getSharpeInterpretation(
            data.token1.sharpeRatio,
            token1Name,
            token1ReturnPct,
            token1VolatilityPct,
            data.riskFreeRate
        ));
        
        // Sortino interpretation
        token1InterpretationDiv.appendChild(getSortinoInterpretation(
            data.token1.sortinoRatio,
            token1Name,
            token1ReturnPct,
            token1DownsideVolPct,
            data.riskFreeRate,
            data.token1.sharpeRatio
        ));

        const token2InterpretationDiv = document.getElementById('token2Interpretation');
        token2InterpretationDiv.innerHTML = '';
        
        // Sharpe interpretation
        token2InterpretationDiv.appendChild(getSharpeInterpretation(
            data.token2.sharpeRatio,
            token2Name,
            token2ReturnPct,
            token2VolatilityPct,
            data.riskFreeRate
        ));
        
        // Sortino interpretation
        token2InterpretationDiv.appendChild(getSortinoInterpretation(
            data.token2.sortinoRatio,
            token2Name,
            token2ReturnPct,
            token2DownsideVolPct,
            data.riskFreeRate,
            data.token2.sharpeRatio
        ));

        // Determine winner (consider both Sharpe and Sortino)
        const winnerDiv = document.getElementById('winner');
        const token1Sharpe = data.token1.sharpeRatio;
        const token2Sharpe = data.token2.sharpeRatio;
        const token1Sortino = data.token1.sortinoRatio;
        const token2Sortino = data.token2.sortinoRatio;

        let winnerText = '';
        if (token1Sharpe > token2Sharpe && token1Sortino > token2Sortino) {
            winnerText = `🏆 ${token1Name} has higher Sharpe (${token1Sharpe.toFixed(3)}) and Sortino (${token1Sortino >= 999 ? '∞' : token1Sortino.toFixed(3)}) ratios - superior risk-adjusted returns`;
        } else if (token2Sharpe > token1Sharpe && token2Sortino > token1Sortino) {
            winnerText = `🏆 ${token2Name} has higher Sharpe (${token2Sharpe.toFixed(3)}) and Sortino (${token2Sortino >= 999 ? '∞' : token2Sortino.toFixed(3)}) ratios - superior risk-adjusted returns`;
        } else if (token1Sharpe > token2Sharpe) {
            winnerText = `🏆 ${token1Name} has higher Sharpe ratio (${token1Sharpe.toFixed(3)} vs ${token2Sharpe.toFixed(3)}), but ${token2Name} has better downside protection (Sortino: ${token2Sortino >= 999 ? '∞' : token2Sortino.toFixed(3)} vs ${token1Sortino >= 999 ? '∞' : token1Sortino.toFixed(3)})`;
        } else if (token2Sharpe > token1Sharpe) {
            winnerText = `🏆 ${token2Name} has higher Sharpe ratio (${token2Sharpe.toFixed(3)} vs ${token1Sharpe.toFixed(3)}), but ${token1Name} has better downside protection (Sortino: ${token1Sortino >= 999 ? '∞' : token1Sortino.toFixed(3)} vs ${token2Sortino >= 999 ? '∞' : token2Sortino.toFixed(3)})`;
        } else {
            winnerText = 'Both tokens have similar risk-adjusted returns';
        }
        
        winnerDiv.textContent = winnerText;
        winnerDiv.className = 'winner higher';

        // Show results
        results.classList.remove('hidden');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
});

