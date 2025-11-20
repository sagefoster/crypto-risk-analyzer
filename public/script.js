document.addEventListener('DOMContentLoaded', async () => {
    // Handle initial page load screen
    const initialLoader = document.getElementById('initialLoader');
    const mainContent = document.getElementById('mainContent');
    
    // Show loader immediately
    if (initialLoader) {
        initialLoader.style.display = 'flex';
        initialLoader.classList.remove('hidden');
    }
    
    // Hide main content initially
    if (mainContent) {
        mainContent.style.opacity = '0';
    }
    
    // Simulate loading progress (can be replaced with actual loading logic)
    const progressBar = document.querySelector('.loader-progress-bar');
    if (progressBar) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 100) {
                progress = 100;
                clearInterval(interval);
                
                // Hide loader after a brief delay
                setTimeout(() => {
                    if (initialLoader) {
                        initialLoader.classList.add('hidden');
                        setTimeout(() => {
                            initialLoader.style.display = 'none';
                        }, 800);
                    }
                    if (mainContent) {
                        mainContent.style.opacity = '1';
                    }
                }, 300);
            } else {
                progressBar.style.width = `${progress}%`;
            }
        }, 100);
    } else {
        // Fallback: hide loader after 2 seconds
        setTimeout(() => {
            if (initialLoader) {
                initialLoader.classList.add('hidden');
                setTimeout(() => {
                    initialLoader.style.display = 'none';
                }, 800);
            }
            if (mainContent) {
                mainContent.style.opacity = '1';
            }
        }, 2000);
    }
    
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
    const btnLoading = document.getElementById('btnLoading');
    
    // Ensure all loading sections stay hidden on page load
    if (loading) {
        loading.classList.add('hidden');
        loading.style.display = 'none'; // Double ensure
    }
    if (btnLoading) {
        btnLoading.classList.add('hidden');
        btnLoading.style.display = 'none'; // Double ensure
    }
    
    let tokenIndex = 3; // Start at 3 since we already have token0, token1, token2

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
        
        const assetNumber = tokenIndex + 1; // Display number (1-indexed)
        tokenGroup.innerHTML = `
            <div class="form-group">
                <label for="token${tokenIndex}">Digital Asset ${assetNumber} <span class="info-icon-small" data-tooltip="Autocomplete available as you type">ⓘ</span></label>
                <div class="token-input-wrapper">
                    <input type="text" class="token-input" id="token${tokenIndex}" name="token${tokenIndex}" placeholder="bitcoin, BTC, ethereum, ETH" required>
                    <button type="button" class="btn-remove-token" aria-label="Clear input">×</button>
                </div>
                <small>Enter ticker symbol or token's name</small>
            </div>
        `;
        
        tokensContainer.appendChild(tokenGroup);
        
        // Add event listener to clear button (clears input, doesn't remove the input box)
        const clearBtn = tokenGroup.querySelector('.btn-remove-token');
        const inputField = tokenGroup.querySelector('.token-input');
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (inputField) {
                inputField.value = '';
                inputField.focus();
                // Close any open autocomplete dropdown
                const existingDropdown = tokenGroup.querySelector('.autocomplete-dropdown');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
            }
        });
        
        tokenIndex++;
        updateRemoveButtons();
        
        // Setup autocomplete for new input
        const newInput = tokenGroup.querySelector('.token-input');
        if (newInput) {
            setupAutocomplete(newInput);
        }

        // Focus the newly created input to keep keyboard open on mobile (only when user clicks add button)
        // Use setTimeout to ensure DOM is fully updated
        if (shouldFocus) {
            setTimeout(() => {
                if (newInput) {
                    newInput.focus();
                }
            }, 100);
        }
    }

    // Function to update clear button visibility and add button state
    function updateRemoveButtons() {
        const tokenGroups = tokensContainer.querySelectorAll('.token-input-group');
        
        // Always show clear button (it clears input, doesn't remove the input box)
        tokenGroups.forEach((group, index) => {
            const clearBtn = group.querySelector('.btn-remove-token');
            clearBtn.classList.remove('hidden');
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

    // Function to validate tokens before analysis
    async function validateTokens(tokens) {
        try {
            const response = await fetch('/api/validate-tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tokens })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Validation failed');
            }

            const invalidTokens = data.results.filter(r => !r.valid);
            if (invalidTokens.length > 0) {
                const invalidList = invalidTokens.map(t => `"${t.tokenId}"`).join(', ');
                const errors = invalidTokens.map(t => t.error || 'Invalid token').join(', ');
                throw new Error(`Invalid token ID(s): ${invalidList}. ${errors}`);
            }

            return true;
        } catch (error) {
            throw error;
        }
    }

    // Autocomplete functionality for token inputs
    function setupAutocomplete(input) {
        let autocompleteDiv = null;
        let searchTimeout = null;

        input.addEventListener('input', async (e) => {
            const query = e.target.value.trim().toLowerCase();
            
            // Clear existing autocomplete
            if (autocompleteDiv) {
                autocompleteDiv.remove();
                autocompleteDiv = null;
            }

            // Clear timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // Don't search if query is too short or empty
            if (query.length < 2) {
                return;
            }

            // Show loading state immediately after 2nd letter
            if (query.length === 2) {
                autocompleteDiv = document.createElement('div');
                autocompleteDiv.className = 'autocomplete-dropdown autocomplete-loading';
                const loadingItem = document.createElement('div');
                loadingItem.className = 'autocomplete-item autocomplete-loading-item';
                loadingItem.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading suggestions...</div>';
                autocompleteDiv.appendChild(loadingItem);
                
                // Position dropdown immediately
                const inputRect = input.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const isMobile = window.innerWidth <= 768;
                
                if (isMobile) {
                    autocompleteDiv.style.position = 'fixed';
                    autocompleteDiv.style.top = `${inputRect.bottom + 4}px`;
                    autocompleteDiv.style.left = `${Math.max(12, inputRect.left)}px`;
                    autocompleteDiv.style.width = `${Math.min(inputRect.width, viewportWidth - 24)}px`;
                    autocompleteDiv.style.maxWidth = `${viewportWidth - 24}px`;
                    autocompleteDiv.style.zIndex = '10000';
                } else {
                    autocompleteDiv.style.position = 'absolute';
                    autocompleteDiv.style.top = `${inputRect.bottom + 4}px`;
                    autocompleteDiv.style.left = `${inputRect.left}px`;
                    autocompleteDiv.style.width = `${inputRect.width}px`;
                }
                
                const wrapper = input.closest('.token-input-wrapper');
                wrapper.parentNode.insertBefore(autocompleteDiv, wrapper.nextSibling);
            }

            // Debounce search - reduced to 300ms for faster response
            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/search-tokens?query=${encodeURIComponent(query)}`);
                    const data = await response.json();

                    // Remove loading state if it exists
                    if (autocompleteDiv && autocompleteDiv.classList.contains('autocomplete-loading')) {
                        autocompleteDiv.innerHTML = '';
                        autocompleteDiv.classList.remove('autocomplete-loading');
                    } else if (!autocompleteDiv) {
                        // Create autocomplete dropdown if it doesn't exist
                        autocompleteDiv = document.createElement('div');
                        autocompleteDiv.className = 'autocomplete-dropdown';
                    }

                    if (data.results && data.results.length > 0) {
                        
                        // Helper to format market cap
                        const formatMarketCap = (marketCap) => {
                            if (!marketCap || marketCap === 0) return 'N/A';
                            if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
                            if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
                            if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
                            return `$${marketCap.toLocaleString()}`;
                        };

                        // Helper to format price
                        const formatPrice = (price) => {
                            if (!price || price === null) return 'N/A';
                            if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                            if (price >= 1) return `$${price.toFixed(2)}`;
                            if (price >= 0.01) return `$${price.toFixed(4)}`;
                            return `$${price.toFixed(6)}`;
                        };
                        
                        data.results.forEach(coin => {
                            const item = document.createElement('div');
                            item.className = 'autocomplete-item';
                            const marketCap = formatMarketCap(coin.market_cap);
                            const price = formatPrice(coin.current_price);
                            
                            item.innerHTML = `
                                <div class="autocomplete-header">
                                    <strong>${coin.name}</strong> <span class="autocomplete-symbol">${coin.symbol}</span>
                                </div>
                                <div class="autocomplete-details">
                                    <span class="autocomplete-price">${price}</span>
                                    <span class="autocomplete-marketcap">${marketCap}</span>
                                </div>
                                <small class="autocomplete-id">ID: ${coin.id}</small>
                            `;
                            item.addEventListener('mousedown', (e) => {
                                e.preventDefault(); // Prevent input blur
                            });
                            
                            item.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Set the value
                                input.value = coin.id;
                                
                                // Immediately close dropdown after selection
                                if (autocompleteDiv) {
                                    autocompleteDiv.style.display = 'none'; // Hide immediately
                                    autocompleteDiv.remove();
                                    autocompleteDiv = null;
                                }
                                
                                // Clear any pending search timeouts
                                if (searchTimeout) {
                                    clearTimeout(searchTimeout);
                                    searchTimeout = null;
                                }
                                
                                // Remove any existing click listeners
                                const existingListeners = document.querySelectorAll('.autocomplete-dropdown');
                                existingListeners.forEach(dropdown => dropdown.remove());
                                
                                // Focus input after a brief delay to ensure dropdown is closed
                                setTimeout(() => {
                                    input.focus();
                                    input.blur(); // Trigger blur to close any remaining dropdowns
                                    setTimeout(() => input.focus(), 50);
                                }, 10);
                            });
                            autocompleteDiv.appendChild(item);
                        });

                        // Position dropdown - mobile-first positioning with viewport awareness
                        // Only reposition if not already positioned (from loading state)
                        if (!autocompleteDiv.style.position || autocompleteDiv.style.position === 'static' || autocompleteDiv.style.position === '') {
                            const inputRect = input.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const viewportWidth = window.innerWidth;
                            const spaceBelow = viewportHeight - inputRect.bottom;
                            const spaceAbove = inputRect.top;
                            const dropdownMaxHeight = 300;
                            
                            // Use fixed positioning on mobile for better control
                            const isMobile = window.innerWidth <= 768;
                            
                            if (isMobile) {
                                // Mobile: use fixed positioning, ensure it's always visible
                                autocompleteDiv.style.position = 'fixed';
                                
                                // Calculate optimal position - prefer below, but show above if not enough space
                                let topPosition;
                                let maxHeight;
                                
                                if (spaceBelow >= dropdownMaxHeight + 20) {
                                    // Enough space below - show below input
                                    topPosition = inputRect.bottom + 4;
                                    maxHeight = Math.min(dropdownMaxHeight, spaceBelow - 20);
                                } else if (spaceAbove >= dropdownMaxHeight + 20) {
                                    // Not enough space below, but enough above - show above input
                                    topPosition = Math.max(8, inputRect.top - dropdownMaxHeight - 4);
                                    maxHeight = Math.min(dropdownMaxHeight, spaceAbove - 20);
                                } else {
                                    // Limited space - show in available space, prefer below
                                    if (spaceBelow > spaceAbove) {
                                        topPosition = inputRect.bottom + 4;
                                        maxHeight = Math.max(150, spaceBelow - 20);
                                    } else {
                                        topPosition = Math.max(8, inputRect.top - Math.min(dropdownMaxHeight, spaceAbove - 4));
                                        maxHeight = Math.max(150, spaceAbove - 20);
                                    }
                                }
                                
                                autocompleteDiv.style.top = `${topPosition}px`;
                                autocompleteDiv.style.left = `${Math.max(12, inputRect.left)}px`;
                                autocompleteDiv.style.width = `${Math.min(inputRect.width, viewportWidth - 24)}px`;
                                autocompleteDiv.style.maxWidth = `${viewportWidth - 24}px`;
                                autocompleteDiv.style.maxHeight = `${maxHeight}px`;
                                autocompleteDiv.style.zIndex = '10000';
                            } else {
                                // Desktop: use absolute positioning
                                autocompleteDiv.style.position = 'absolute';
                                autocompleteDiv.style.top = `${inputRect.bottom + 4}px`;
                                autocompleteDiv.style.left = `${inputRect.left}px`;
                                autocompleteDiv.style.width = `${inputRect.width}px`;
                            }
                        }

                        // Insert after input wrapper
                        const wrapper = input.closest('.token-input-wrapper');
                        wrapper.parentNode.insertBefore(autocompleteDiv, wrapper.nextSibling);

                        // Close on outside click - use capture phase for better reliability
                        const closeHandler = (e) => {
                            if (autocompleteDiv && !autocompleteDiv.contains(e.target) && e.target !== input && !input.contains(e.target)) {
                                autocompleteDiv.remove();
                                autocompleteDiv = null;
                                document.removeEventListener('click', closeHandler, true);
                                document.removeEventListener('touchstart', closeHandler, true);
                            }
                        };
                        
                        // Use both click and touchstart for mobile
                        setTimeout(() => {
                            document.addEventListener('click', closeHandler, true);
                            document.addEventListener('touchstart', closeHandler, true);
                        }, 100);
                    } else {
                        // No results - remove loading state if it exists
                        if (autocompleteDiv) {
                            autocompleteDiv.remove();
                            autocompleteDiv = null;
                        }
                    }
                } catch (error) {
                    console.error('Autocomplete error:', error);
                    // Remove loading state on error
                    if (autocompleteDiv) {
                        autocompleteDiv.remove();
                        autocompleteDiv = null;
                    }
                }
            }, 300); // Reduced to 300ms for faster response
        });

        // Remove autocomplete when input loses focus (after a delay to allow clicks)
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (autocompleteDiv) {
                    autocompleteDiv.remove();
                    autocompleteDiv = null;
                }
            }, 150); // Reduced delay for better mobile responsiveness
        });
        
        // Also close on input change if value is cleared
        input.addEventListener('input', (e) => {
            if (!e.target.value.trim() && autocompleteDiv) {
                autocompleteDiv.remove();
                autocompleteDiv = null;
            }
        });
    }

    // Random crypto button functionality
    const randomCryptoBtn = document.getElementById('randomCryptoBtn');
    if (randomCryptoBtn) {
        randomCryptoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Random crypto options: DOGE, XRP, SOL, LINK, ZEC, BNB, TRX, LTC
            const randomCryptos = ['dogecoin', 'ripple', 'solana', 'chainlink', 'zcash', 'binancecoin', 'tron', 'litecoin'];
            const randomCrypto = randomCryptos[Math.floor(Math.random() * randomCryptos.length)];
            
            // Get the third input (token2)
            const token2Input = document.getElementById('token2');
            if (token2Input) {
                token2Input.value = randomCrypto;
                
                // Add a brief highlight animation
                token2Input.style.animation = 'none';
                setTimeout(() => {
                    token2Input.style.animation = 'highlightPulse 0.6s ease';
                }, 10);
                
                // Focus the input
                setTimeout(() => {
                    token2Input.focus();
                }, 100);
            }
        });
    }

    // Setup autocomplete and clear buttons for existing inputs (including first input)
    document.querySelectorAll('.token-input-group').forEach(group => {
        const input = group.querySelector('.token-input');
        const clearBtn = group.querySelector('.btn-remove-token');
        
        // Setup autocomplete
        if (input) {
            setupAutocomplete(input);
        }
        
        // Setup clear button for first input (and any others that might not have it)
        if (clearBtn && input) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = '';
                input.focus();
                // Close any open autocomplete dropdown
                const existingDropdown = group.querySelector('.autocomplete-dropdown');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
                // Also check for dropdowns in the parent container
                const allDropdowns = document.querySelectorAll('.autocomplete-dropdown');
                allDropdowns.forEach(dropdown => {
                    if (dropdown.parentNode === group || dropdown.parentNode === group.parentNode) {
                        dropdown.remove();
                    }
                });
            });
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous results and errors
        results.classList.add('hidden');
        errorDiv.classList.add('hidden');
        
        // Ensure bottom loading section stays hidden (we use button loading instead)
        if (loading) {
            loading.classList.add('hidden');
            loading.style.display = 'none';
        }
        
        // Collect tokens
        const tokens = collectTokens();
        
        if (tokens.length === 0) {
            showError('Please enter at least one digital asset (name, ticker symbol, or ID)');
            return;
        }
        
        if (tokens.length < 2) {
            showError('Please enter at least two digital assets to compare');
            return;
        }

        // Validate tokens before analysis
        const btnLoading = document.getElementById('btnLoading');
        const loadingDetails = document.getElementById('loadingDetails');
        analyzeBtn.classList.add('hidden');
        analyzeBtn.style.display = 'none';
        btnLoading.classList.remove('hidden');
        btnLoading.style.display = '';
        loadingDetails.textContent = 'Validating digital assets...';

        try {
            // Validate tokens first
            await validateTokens(tokens);
            
            // Loading messages to rotate through
            const loadingMessages = [
                'Fetching price data from CoinGecko...',
                'Retrieving S&P 500 data...',
                'Calculating daily returns...',
                'Computing volatility metrics...',
                'Analyzing risk-adjusted ratios...',
                'Calculating maximum drawdown...',
                'Computing correlation & beta...',
                'Finalizing analysis...'
            ];
            
            let messageIndex = 0;
            let messageInterval = setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                loadingDetails.textContent = loadingMessages[messageIndex];
            }, 1500);

            const timeframe = document.getElementById('timeframe').value;

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
                // Show detailed error message from server
                const errorMsg = data.error || 'Analysis failed';
                console.error('Server error:', errorMsg);
                console.error('Response data:', data);
                throw new Error(errorMsg);
            }

            // Clear message rotation
            if (messageInterval) {
                clearInterval(messageInterval);
            }
            
            // Display results
            displayResults(data);
            
        } catch (error) {
            if (typeof messageInterval !== 'undefined' && messageInterval) {
                clearInterval(messageInterval);
            }
            console.error('Error:', error);
            showError(error.message || 'An error occurred while analyzing the digital assets. Please check your API key and asset names/symbols.');
        } finally {
            // Hide loading state, show button
            if (btnLoading) {
                btnLoading.classList.add('hidden');
                btnLoading.style.display = 'none';
            }
            if (analyzeBtn) {
                analyzeBtn.classList.remove('hidden');
                analyzeBtn.style.display = '';
            }
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
            interpretation = `Extreme volatility. With a standard deviation of ${volatilityPct}% over ${timeframeText}, ${tokenName} experienced severe price fluctuations. This level of volatility means prices regularly moved far from the average - expect large gains or losses.`;
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
        const isOneYear = timeframeText === '1 year';
        
        // Main interpretation based on actual performance
        let mainInterpretation = '';
        const dollarResult = (100 * (1 + periodReturn)).toFixed(2);
        
        if (periodReturn > 0.50) {
            mainInterpretation = `<strong>Strong returns:</strong> ${tokenName} gained ${periodReturnPct}% over ${timeframeText}. A $100 investment would be worth $${dollarResult}.`;
        } else if (periodReturn > 0.20) {
            mainInterpretation = `<strong>Positive returns:</strong> ${tokenName} gained ${periodReturnPct}% over ${timeframeText}. A $100 investment would be worth $${dollarResult}.`;
        } else if (periodReturn > 0) {
            mainInterpretation = `<strong>Modest gains:</strong> ${tokenName} gained ${periodReturnPct}% over ${timeframeText}. A $100 investment would be worth $${dollarResult}.`;
        } else if (periodReturn > -0.20) {
            mainInterpretation = `<strong>Negative returns:</strong> ${tokenName} lost ${Math.abs(parseFloat(periodReturnPct))}% over ${timeframeText}. A $100 investment would be worth $${dollarResult}.`;
        } else {
            mainInterpretation = `<strong>Significant losses:</strong> ${tokenName} declined ${Math.abs(parseFloat(periodReturnPct))}% over ${timeframeText}. A $100 investment would be worth $${dollarResult}.`;
        }
        
        // Build metrics details based on timeframe
        let metricsHTML = '';
        
        if (isOneYear) {
            // For 1 year: Show Period Return and Annualized Return (skip CAGR as it's redundant)
            const hasMeaningfulDifference = Math.abs(parseFloat(periodReturnPct) - parseFloat(annualizedReturnPct)) > 1;
            
            metricsHTML = `
                <p><strong>Period Return: ${periodReturnPct}%</strong><br>
                This is your actual return-what really happened to your investment from start to end over ${timeframeText}.</p>
                
                <p><strong>Annualized Return (Arithmetic): ${annualizedReturnPct}%</strong><br>
                The average daily return × 252 trading days. Used in Sharpe/Sortino calculations. ${hasMeaningfulDifference ? `Differs from Period Return due to <em>volatility drag</em>-when prices swing daily, the arithmetic average doesn't match the geometric result.` : 'Similar to Period Return for this low-volatility period.'}</p>
            `;
        } else {
            // For multi-year periods: Show all three metrics
            metricsHTML = `
                <p><strong>Period Return: ${periodReturnPct}%</strong><br>
                Your total return from start to end over ${timeframeText}.</p>
                
                <p><strong>CAGR: ${cagrPct}%</strong><br>
                Compound Annual Growth Rate-the smoothed yearly return if growth was consistent. Formula: ((Ending ÷ Starting)^(1 ÷ Years)) - 1</p>
                
                <p><strong>Annualized Return (Arithmetic): ${annualizedReturnPct}%</strong><br>
                Average daily return × 252 trading days. Used in Sharpe/Sortino ratios. This arithmetic mean differs from CAGR's geometric calculation-higher volatility creates a bigger gap.</p>
            `;
        }
        
        const whichToUseText = isOneYear 
            ? `<p><strong>Which to Use?</strong> Period Return shows actual performance. Annualized Return is used for academic risk calculations but may not match real results due to volatility.</p>`
            : `<p><strong>Which to Use?</strong> Period Return for total gain/loss. CAGR for year-over-year growth rate. Annualized Return for academic comparisons (Sharpe/Sortino calculations).</p>`;
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Return Metrics:</strong> How ${tokenName} performed over ${timeframeText}
            </div>
            <p class="interpretation-text">${mainInterpretation}</p>
            <div class="interpretation-details">
                ${metricsHTML}
                ${whichToUseText}
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

    function getCalmarInterpretation(calmarRatio, tokenName, annualizedReturn, maxDrawdown, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content calmar-interpretation';
        
        const annRetPct = (annualizedReturn * 100).toFixed(2);
        const mddPct = (maxDrawdown * 100).toFixed(2);
        
        let interpretation = '';
        let interpretationClass = '';
        
        if (calmarRatio === null || !isFinite(calmarRatio)) {
            interpretation = `Calmar Ratio cannot be calculated due to zero or near-zero maximum drawdown. This means ${tokenName} had no significant peak-to-trough decline during ${timeframeText}, which is unusual for crypto assets.`;
            interpretationClass = 'moderate';
        } else if (calmarRatio > 3) {
            interpretation = `Excellent risk-adjusted returns. ${tokenName}'s Calmar Ratio of ${calmarRatio.toFixed(3)} over ${timeframeText} is exceptional. This means you're getting ${calmarRatio.toFixed(2)}x return for every 1% of maximum drawdown-a highly efficient return profile.`;
            interpretationClass = 'excellent';
        } else if (calmarRatio > 1) {
            interpretation = `Good risk-adjusted returns. With a Calmar Ratio of ${calmarRatio.toFixed(3)} over ${timeframeText}, ${tokenName} delivers solid returns relative to its worst drawdown. You're earning more in returns than you risk losing in drawdowns.`;
            interpretationClass = 'good';
        } else if (calmarRatio > 0) {
            interpretation = `Modest risk-adjusted returns. ${tokenName}'s Calmar Ratio of ${calmarRatio.toFixed(3)} over ${timeframeText} indicates that drawdown risk is high relative to returns. Returns aren't fully compensating for worst-case losses.`;
            interpretationClass = 'moderate';
        } else {
            interpretation = `Negative Calmar Ratio. ${tokenName} had negative returns (${annRetPct}%) with a ${mddPct}% max drawdown over ${timeframeText}. This represents poor performance-losses combined with significant drawdown risk.`;
            interpretationClass = 'poor';
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Calmar Ratio:</strong> Return per unit of maximum drawdown
            </div>
            <p class="interpretation-text ${interpretationClass}">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>Formula:</strong> Calmar Ratio = Annualized Return ÷ |Maximum Drawdown|</p>
                <p><strong>${tokenName}'s Calculation:</strong> ${annRetPct}% ÷ ${mddPct}% = ${calmarRatio !== null && isFinite(calmarRatio) ? calmarRatio.toFixed(3) : 'N/A'}</p>
                <p><strong>What It Means:</strong> While Sharpe/Sortino use volatility (standard deviation) to measure risk, Calmar focuses on your actual worst-case loss (max drawdown). It answers: "How much return do I get for the biggest loss I might experience?"</p>
                <p><strong>Why It's Useful:</strong> Popular with hedge funds and CTAs because drawdowns are what investors actually feel. A high Calmar Ratio means strong returns without suffering devastating losses. >3 is excellent, >1 is good, <0 is concerning.</p>
                ${calmarRatio !== null && isFinite(calmarRatio) ? `<p><strong>Context:</strong> For every 1% of maximum loss during ${timeframeText}, ${tokenName} delivered ${calmarRatio.toFixed(2)}% of annualized return.</p>` : ''}
            </div>
            <div class="interpretation-separator"></div>
        `;
        
        return interpretationDiv;
    }

    function getBetaInterpretation(betaToBTC, betaToSP500, tokenName, isBitcoin, timeframeText) {
        const interpretationDiv = document.createElement('div');
        interpretationDiv.className = 'interpretation-content beta-interpretation';
        
        let interpretation = '';
        
        // Bitcoin special case
        if (isBitcoin) {
            interpretation = `${tokenName} has a Beta of 1.0 to itself (by definition). Its Beta to S&P 500 is ${betaToSP500 !== null ? betaToSP500.toFixed(3) : 'N/A'}, indicating ${betaToSP500 > 1 ? 'higher volatility than' : betaToSP500 < 1 ? 'lower volatility than' : 'similar volatility to'} traditional markets.`;
        } else {
            const btcInterpretation = betaToBTC !== null ? 
                `${tokenName} has a Beta of ${betaToBTC.toFixed(3)} to Bitcoin, meaning it ${betaToBTC > 1.2 ? 'amplifies' : betaToBTC > 0.8 ? 'closely tracks' : 'dampens'} BTC's movements.` :
                `Beta to Bitcoin is unavailable.`;
            
            const sp500Interpretation = betaToSP500 !== null ?
                `Beta to S&P 500 is ${betaToSP500.toFixed(3)}, showing ${betaToSP500 > 1 ? 'more volatile than' : betaToSP500 < 1 ? 'less volatile than' : 'similar volatility to'} traditional markets.` :
                `Beta to S&P 500 is unavailable.`;
            
            interpretation = `${btcInterpretation} ${sp500Interpretation}`;
        }
        
        interpretationDiv.innerHTML = `
            <div class="interpretation-header">
                <strong>Beta Analysis:</strong> Sensitivity to Bitcoin and S&P 500 movements
            </div>
            <p class="interpretation-text">${interpretation}</p>
            <div class="interpretation-details">
                <p><strong>What Beta Measures:</strong> Beta quantifies how much an asset moves relative to a benchmark. Beta = Covariance(asset, benchmark) ÷ Variance(benchmark).</p>
                <p><strong>Interpreting Values:</strong></p>
                <ul style="margin-left: 20px; line-height: 1.8;">
                    <li><strong>Beta = 1.0:</strong> Moves in lockstep with benchmark</li>
                    <li><strong>Beta > 1.0:</strong> Amplifies benchmark moves (more volatile)</li>
                    <li><strong>Beta < 1.0:</strong> Dampens benchmark moves (less volatile)</li>
                    <li><strong>Beta ≈ 0:</strong> No relationship to benchmark</li>
                    <li><strong>Beta < 0:</strong> Moves opposite to benchmark (rare)</li>
                </ul>
                ${betaToBTC !== null ? `<p><strong>Bitcoin Beta (${betaToBTC.toFixed(3)}):</strong> ${betaToBTC > 1.2 ? `${tokenName} is more volatile than Bitcoin-when BTC moves 1%, ${tokenName} tends to move ${betaToBTC.toFixed(1)}%.` : betaToBTC < 0.8 ? `${tokenName} is less volatile than Bitcoin-provides some diversification benefit within crypto.` : `${tokenName} moves closely with Bitcoin-limited diversification benefit.`}</p>` : ''}
                ${betaToSP500 !== null ? `<p><strong>S&P 500 Beta (${betaToSP500.toFixed(3)}):</strong> ${betaToSP500 > 1 ? `Higher volatility than traditional stocks-crypto-specific risks dominate.` : betaToSP500 < 0.5 ? `Low correlation to traditional markets-potential portfolio diversifier.` : `Moderate correlation to traditional markets.`}</p>` : ''}
                <p class="context-note"><strong>⚠️ Important Caveat:</strong> Beta assumes the asset is part of a <em>diversified portfolio</em>. Individual crypto assets are NOT diversified-they have idiosyncratic (asset-specific) risks that Beta doesn't capture. Use Beta cautiously for single assets. It's most useful for understanding relative movements, not absolute risk.</p>
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
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> - Moves independently from stocks. Great diversification.`;
                sp500Class = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> - Some relationship with stocks. Good diversification.`;
                sp500Class = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> - Tends to move with stocks. Limited diversification.`;
                sp500Class = 'moderate';
            } else {
                sp500Text = `<strong>${corrValue.toFixed(2)}</strong> - Moves closely with stocks. Minimal diversification.`;
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
                btcText = `<strong>${corrValue.toFixed(2)}</strong> - Independent from Bitcoin. Unique price drivers.`;
                btcClass = 'excellent';
            } else if (Math.abs(corrValue) < 0.5) {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> - Some Bitcoin influence. Maintains independence.`;
                btcClass = 'good';
            } else if (Math.abs(corrValue) < 0.7) {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> - Follows Bitcoin trends closely.`;
                btcClass = 'moderate';
            } else {
                btcText = `<strong>${corrValue.toFixed(2)}</strong> - Highly dependent on Bitcoin price action.`;
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
        
        // Helper function to create metric name cell with tooltip
        const createMetricNameCell = (metricName, tooltipMetric) => {
            return `<td class="metric-name">
                <span class="metric-name-text">${metricName}</span>
                <span class="info-icon table-info-icon" data-metric="${tooltipMetric}" data-timeframe="${timeframeText}">ⓘ</span>
            </td>`;
        };
        
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
                            ${createMetricNameCell('Period Return', 'periodReturn')}
                            ${tokenResults.map(t => `<td class="metric-value">${(t.periodReturn * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('CAGR', 'periodReturn')}
                            ${tokenResults.map(t => `<td class="metric-value">${(t.cagr * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Annualized Return', 'annualizedReturn')}
                            ${tokenResults.map(t => `<td class="metric-value">${(t.annualizedReturn * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Volatility (standard deviation)', 'volatility')}
                            ${tokenResults.map(t => `<td class="metric-value">${(t.volatility * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Max Drawdown', 'maxDrawdown')}
                            ${tokenResults.map(t => {
                                const mdd = (t.maxDrawdown * 100).toFixed(2);
                                return `<td class="metric-value">${t.maxDrawdown > 0 ? `-${mdd}` : mdd}%</td>`;
                            }).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Sharpe Ratio', 'sharpe')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.sharpeRatio.toFixed(3)}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Sortino Ratio', 'sortino')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.sortinoRatio >= 999 ? '∞' : t.sortinoRatio.toFixed(3)}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Calmar Ratio', 'calmar')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.calmarRatio !== null && isFinite(t.calmarRatio) ? t.calmarRatio.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Downside Volatility', 'volatility')}
                            ${tokenResults.map(t => `<td class="metric-value">${(t.downsideVolatility * 100).toFixed(2)}%</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Beta to S&P 500', 'betaSP500')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.betaToSP500 !== null ? t.betaToSP500.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Beta to Bitcoin', 'betaBTC')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.betaToBitcoin !== null ? t.betaToBitcoin.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Correlation to S&P 500', 'correlationSP500')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.correlationToSP500 !== null ? t.correlationToSP500.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                        <tr>
                            ${createMetricNameCell('Correlation to Bitcoin', 'correlationBTC')}
                            ${tokenResults.map(t => `<td class="metric-value">${t.correlationToBitcoin !== null ? t.correlationToBitcoin.toFixed(3) : 'N/A'}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        tableWrapper.innerHTML = tableHTML;
        
        // Attach tooltip handlers to table info icons
        const tableInfoIcons = tableWrapper.querySelectorAll('.table-info-icon');
        tableInfoIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const metric = icon.dataset.metric;
                const timeframe = icon.dataset.timeframe || '1 year';
                
                // Get the first token's value for this metric to use in tooltip
                let exampleValue = '';
                const row = icon.closest('tr');
                if (row) {
                    const firstValueCell = row.querySelector('.metric-value');
                    if (firstValueCell) {
                        exampleValue = firstValueCell.textContent.trim();
                        // Remove % or other suffixes for numeric parsing
                        exampleValue = exampleValue.replace(/[%∞N/A]/g, '').trim();
                    }
                }
                
                // Remove any existing tooltips
                document.querySelectorAll('.metric-tooltip-popup').forEach(t => t.remove());
                
                // Create tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'metric-tooltip-popup';
                
                const content = getMetricTooltipContent(metric, exampleValue || '', timeframe, tokenResults);
                
                tooltip.innerHTML = `
                    <div class="tooltip-header">
                        <strong>${content.title}</strong>
                        <span class="tooltip-close">×</span>
                    </div>
                    <div class="tooltip-content">${content.content}</div>
                `;
                
                // Position tooltip near the icon
                document.body.appendChild(tooltip);
                
                const iconRect = icon.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // Position below the icon, centered
                let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
                let top = iconRect.bottom + 8;
                
                // Keep tooltip on screen
                if (left < 10) left = 10;
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }
                
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                
                // Close button handler
                tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
                    tooltip.remove();
                });
                
                // Close on outside click
                setTimeout(() => {
                    document.addEventListener('click', function closeTooltip(e) {
                        if (!tooltip.contains(e.target) && !icon.contains(e.target)) {
                            tooltip.remove();
                            document.removeEventListener('click', closeTooltip);
                        }
                    });
                }, 100);
            });
        });
        
        return tableWrapper;
    }

    // Helper function to format prices with appropriate decimals for low values
    // Defined at higher scope so it can be used by multiple functions
    function formatPriceDisplay(price) {
        if (!price || price === null || price === undefined || isNaN(price)) return 'N/A';
        if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
        if (price >= 1) return price.toFixed(2);
        if (price >= 0.01) return price.toFixed(4);
        if (price >= 0.0001) return price.toFixed(6);
        return price.toFixed(8); // Very low values get 8 decimals
    }

    function createWinnerSection(tokenResults, riskFreeRate, timeframeDays) {
        // Sort tokens by composite score weighing Sharpe, Sortino, and Calmar ratios
        const sortedTokens = [...tokenResults].sort((a, b) => {
            // Primary: Sharpe ratio (most widely used)
            if (Math.abs(a.sharpeRatio - b.sharpeRatio) > 0.1) {
                return b.sharpeRatio - a.sharpeRatio;
            }
            
            // Secondary: Sortino ratio (downside risk focus)
            const sortinoA = a.sortinoRatio >= 999 ? 999 : a.sortinoRatio;
            const sortinoB = b.sortinoRatio >= 999 ? 999 : b.sortinoRatio;
            if (Math.abs(sortinoA - sortinoB) > 0.1) {
                return sortinoB - sortinoA;
            }
            
            // Tertiary: Calmar ratio (drawdown focus)
            const calmarA = a.calmarRatio !== null && isFinite(a.calmarRatio) ? a.calmarRatio : -999;
            const calmarB = b.calmarRatio !== null && isFinite(b.calmarRatio) ? b.calmarRatio : -999;
            return calmarB - calmarA;
        });

        const winner = sortedTokens[0];
        const winnerName = winner.id.toUpperCase();
        const timeframeText = getTimeframeText(timeframeDays);
        
        // Get other assets for comparison text
        const otherAssets = sortedTokens
            .filter(t => t.id !== winner.id)
            .map(t => t.id.toUpperCase());
        
        let comparisonText = '';
        if (otherAssets.length > 0) {
            if (otherAssets.length === 1) {
                comparisonText = ` compared to ${otherAssets[0]}`;
            } else if (otherAssets.length === 2) {
                comparisonText = ` compared to ${otherAssets[0]} and ${otherAssets[1]}`;
            } else {
                const lastAsset = otherAssets[otherAssets.length - 1];
                const otherAssetsList = otherAssets.slice(0, -1).join(', ');
                comparisonText = ` compared to ${otherAssetsList}, and ${lastAsset}`;
            }
        }
        
        // Format all metrics for winner - use period return for simple holding period return
        const winnerReturn = (winner.periodReturn * 100).toFixed(2);
        const winnerVol = (winner.volatility * 100).toFixed(2);
        const winnerMDD = (winner.maxDrawdown * 100).toFixed(2);
        const winnerMDDDisplay = winner.maxDrawdown > 0 ? `-${winnerMDD}` : winnerMDD;
        const winnerSharpe = winner.sharpeRatio.toFixed(3);
        const winnerSortino = winner.sortinoRatio >= 999 ? '∞' : winner.sortinoRatio.toFixed(3);
        const winnerCalmar = winner.calmarRatio !== null && isFinite(winner.calmarRatio) ? winner.calmarRatio.toFixed(3) : 'N/A';

        // Format price data with appropriate decimals for low values
        const winnerLow = formatPriceDisplay(winner.lowPrice);
        const winnerHigh = formatPriceDisplay(winner.highPrice);
        const winnerCurrent = formatPriceDisplay(winner.currentPrice);

        // Determine range label for winner section
        const winnerRangeLabel = timeframeText === '1 year' ? '52-Week High/Low' : `${timeframeText} Range`;
        
        // Determine return label based on timeframe
        const winnerReturnLabel = timeframeText === '1 year' ? '1 Year Return' : `${timeframeText} Return`;
        
        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'winner higher';
        winnerDiv.innerHTML = `
            <div class="winner-header">🏆 <strong>${winnerName}</strong> shows the best overall risk-adjusted performance over the past ${timeframeText}${comparisonText}</div>
            <div class="winner-price-range">
                <div class="price-range-line-1">
                    <span class="price-label">${winnerRangeLabel}</span>
                    <span class="info-icon" data-metric="priceRange" data-timeframe="${timeframeText}">ⓘ</span>
                </div>
                <div class="price-range-line-2">
                    <span class="price-value">$${winnerHigh} - $${winnerLow}</span>
                </div>
                <div class="price-range-line-3">
                    <span class="price-context">Current: $${winnerCurrent}</span>
                </div>
            </div>
            <div class="winner-metrics">
                <div class="winner-metric-row">
                    <span class="metric-label">${winnerReturnLabel}:</span> <span class="metric-value">${winnerReturn}% <span class="info-icon" data-metric="periodReturn" data-value="${winnerReturn}" data-timeframe="${timeframeText}">ⓘ</span></span>
                    <span class="metric-label">Std Deviation (σ):</span> <span class="metric-value">${winnerVol}% <span class="info-icon" data-metric="volatility" data-value="${winnerVol}">ⓘ</span></span>
                    <span class="metric-label">Max Drawdown:</span> <span class="metric-value">${winnerMDDDisplay}% <span class="info-icon" data-metric="maxDrawdown" data-value="${winnerMDDDisplay}">ⓘ</span></span>
                </div>
                <div class="winner-metric-row">
                    <span class="metric-label">Sharpe Ratio:</span> <span class="metric-value">${winnerSharpe} <span class="info-icon" data-metric="sharpe" data-value="${winnerSharpe}">ⓘ</span></span>
                    <span class="metric-label">Sortino Ratio:</span> <span class="metric-value">${winnerSortino} <span class="info-icon" data-metric="sortino" data-value="${winnerSortino}">ⓘ</span></span>
                    <span class="metric-label">Calmar Ratio:</span> <span class="metric-value">${winnerCalmar} <span class="info-icon" data-metric="calmar" data-value="${winnerCalmar}">ⓘ</span></span>
                </div>
            </div>
        `;
        
        // Add comparison text for multiple tokens
        if (sortedTokens.length === 2) {
            const second = sortedTokens[1];
            const secondName = second.id.toUpperCase();
            const secondReturn = (second.periodReturn * 100).toFixed(2);
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
            // Get other assets for comparison text
            const otherAssets = sortedTokens
                .filter(t => t.id !== winner.id)
                .map(t => t.id.toUpperCase());
            
            let comparisonText = '';
            if (otherAssets.length > 0) {
                if (otherAssets.length === 1) {
                    comparisonText = ` compared to ${otherAssets[0]}`;
                } else if (otherAssets.length === 2) {
                    comparisonText = ` compared to ${otherAssets[0]} and ${otherAssets[1]}`;
                } else {
                    const lastAsset = otherAssets[otherAssets.length - 1];
                    const otherAssetsList = otherAssets.slice(0, -1).join(', ');
                    comparisonText = ` compared to ${otherAssetsList}, and ${lastAsset}`;
                }
            }
            
            winnerDiv.innerHTML += `<div class="winner-comparison">Outperforms ${sortedTokens.length - 1} other asset${sortedTokens.length - 1 > 1 ? 's' : ''} over the past ${timeframeText}${comparisonText} based on risk-adjusted return metrics.</div>`;
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
            <p class="overview-context">Analysis period: <strong>${timeframeText}</strong> | Risk-free rate: ${riskFreeRate.toFixed(2)}%</p>
            <p class="tap-hint">💡 Tap any card for details</p>
            <div class="summary-cards">
        `;
        
        tokenResults.forEach(tokenData => {
            const tokenName = tokenData.id.toUpperCase();
            const tokenId = tokenData.id.toLowerCase();
            const returnPct = (tokenData.periodReturn * 100).toFixed(2); // Use period return for quick overview
            const sharpe = tokenData.sharpeRatio.toFixed(2);
            const mdd = (tokenData.maxDrawdown * 100).toFixed(2);
            const mddDisplay = tokenData.maxDrawdown > 0 ? `-${mdd}` : mdd;
            
            // Format price data with appropriate decimals for low values
            const lowPrice = formatPriceDisplay(tokenData.lowPrice);
            const highPrice = formatPriceDisplay(tokenData.highPrice);
            
            const performanceClass = tokenData.sharpeRatio > 1 ? 'excellent' : tokenData.sharpeRatio > 0 ? 'good' : 'poor';
            
            // Determine range label based on timeframe
            let rangeLabel = timeframeText === '1 year' ? '52-Week High/Low' : `${timeframeText} Range`;
            
            // Determine return label based on timeframe
            let returnLabel = timeframeText === '1 year' ? '1 Year Return' : `${timeframeText} Return`;
            
            summaryHTML += `
                <div class="summary-card ${performanceClass} clickable" data-token="${tokenId}" role="button" tabindex="0" aria-label="View detailed analysis for ${tokenName}">
                    <h4>${tokenName}</h4>
                    <div class="price-range-summary">
                        <span class="range-label">${rangeLabel}:</span>
                        <span class="range-value">$${highPrice} - $${lowPrice}</span>
                        <span class="info-icon" data-metric="priceRange" data-timeframe="${timeframeText}">ⓘ</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">${returnLabel}</span>
                        <span class="summary-value">${returnPct}%</span>
                        <span class="info-icon" data-metric="periodReturn" data-value="${returnPct}" data-timeframe="${timeframeText}">ⓘ</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Sharpe Ratio</span>
                        <span class="summary-value">${sharpe}</span>
                        <span class="info-icon" data-metric="sharpe" data-value="${sharpe}">ⓘ</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-label">Max Drawdown</span>
                        <span class="summary-value">${mddDisplay}%</span>
                        <span class="info-icon" data-metric="maxDrawdown" data-value="${mddDisplay}">ⓘ</span>
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

        // STEP 2: Show summary stats for all tokens
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
            
            // Calmar interpretation
            contentArea.appendChild(getCalmarInterpretation(
                tokenData.calmarRatio,
                tokenName,
                tokenData.annualizedReturn,
                tokenData.maxDrawdown,
                timeframeText
            ));
            
            // Beta interpretation (if data available)
            const isBitcoin = tokenData.id.toLowerCase() === 'bitcoin';
            if ((tokenData.betaToSP500 !== null && tokenData.betaToSP500 !== undefined) || 
                (tokenData.betaToBitcoin !== null && tokenData.betaToBitcoin !== undefined)) {
                contentArea.appendChild(getBetaInterpretation(
                    tokenData.betaToBitcoin,
                    tokenData.betaToSP500,
                    tokenName,
                    isBitcoin,
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
        
        // Add info icon click handlers
        setTimeout(() => {
            attachInfoIconHandlers();
        }, 100);
        
        // Auto-scroll to results after a brief delay to allow rendering
        setTimeout(() => {
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }

    function getMetricTooltipContent(metric, value, timeframe, tokenResults = null) {
        // Helper to safely format value
        const formatValue = (val, suffix = '') => {
            if (!val || val === '' || val === 'undefined' || isNaN(parseFloat(val))) {
                return '';
            }
            const numVal = parseFloat(val);
            if (isNaN(numVal)) return '';
            return `${numVal}${suffix}`;
        };
        
        const val = formatValue(value);
        const valPct = formatValue(value, '%');
        const valNum = val ? parseFloat(value) : null;
        
        const tooltips = {
            priceRange: {
                title: timeframe === '1 year' ? '52-Week High/Low' : `${timeframe} Price Range`,
                content: `The highest and lowest prices during ${timeframe}. Shows the full price volatility range over this period. Useful for understanding how much the price fluctuated.`
            },
            periodReturn: {
                title: 'Period Return',
                content: val ? 
                    `Total return from start to end of the period. ${valPct} means if you invested $100 at the start, you'd have $${(100 * (1 + valNum/100)).toFixed(2)} at the end. This is the actual price change you experienced. <strong>Example:</strong> SPY (S&P 500 ETF) typically has 8-12% annual returns over long periods.` :
                    `Total return from start to end of the period. If you invested $100 at the start, this shows what you'd have at the end. This is the actual price change you experienced. <strong>Example:</strong> SPY (S&P 500 ETF) typically has 8-12% annual returns over long periods.`
            },
            annualizedReturn: {
                title: 'Annualized Return',
                content: val ? 
                    `The arithmetic mean of daily returns multiplied by 252 trading days: ${valPct}. Used in Sharpe/Sortino/Calmar calculations. Note: This can differ from actual period return due to volatility drag. See detailed analysis for full explanation. <strong>Example:</strong> SPY's annualized return is typically 8-12% over long periods, though actual returns vary year-to-year.` :
                    `The arithmetic mean of daily returns multiplied by 252 trading days. Used in Sharpe/Sortino/Calmar calculations. Note: This can differ from actual period return due to volatility drag. <strong>Example:</strong> SPY's annualized return is typically 8-12% over long periods, though actual returns vary year-to-year.`
            },
            volatility: {
                title: 'Volatility (Standard Deviation)',
                content: val ? 
                    `Measures price consistency. ${valPct} annualized volatility means daily returns typically vary by this much from the average. Higher = more price swings and risk. About 68% of returns fall within ±${valPct} in a typical year. <strong>Example:</strong> SPY typically has 15-20% annual volatility, while individual stocks can range from 20-40%.` :
                    `Measures price consistency. Annualized volatility shows how much daily returns typically vary from the average. Higher = more price swings and risk. <strong>Example:</strong> SPY typically has 15-20% annual volatility, while individual stocks can range from 20-40%.`
            },
            maxDrawdown: {
                title: 'Maximum Drawdown',
                content: val ? 
                    `Largest peak-to-trough decline: ${valPct}. If you bought at the absolute worst time (the peak), this is how much you'd have lost at the lowest point before any recovery. Shows worst-case scenario risk. <strong>Example:</strong> SPY's worst drawdown was ~50% during the 2008 financial crisis. Tech stocks often see 60-80% drawdowns.` :
                    `Largest peak-to-trough decline. If you bought at the absolute worst time (the peak), this shows how much you'd have lost at the lowest point before any recovery. Shows worst-case scenario risk. <strong>Example:</strong> SPY's worst drawdown was ~50% during the 2008 financial crisis. Tech stocks often see 60-80% drawdowns.`
            },
            sharpe: {
                title: 'Sharpe Ratio',
                content: val ? 
                    `Risk-adjusted return metric: ${val}. Calculated as (Return - Risk-Free Rate) ÷ Volatility. Higher is better. >1 = good, >2 = very good, >3 = excellent. Measures return per unit of total risk. <strong>Example:</strong> SPY typically has a Sharpe ratio of 0.5-1.0. Hedge funds aim for >1.5.` :
                    `Risk-adjusted return metric. Calculated as (Return - Risk-Free Rate) ÷ Volatility. Higher is better. >1 = good, >2 = very good, >3 = excellent. Measures return per unit of total risk. <strong>Example:</strong> SPY typically has a Sharpe ratio of 0.5-1.0. Hedge funds aim for >1.5.`
            },
            sortino: {
                title: 'Sortino Ratio',
                content: val ? 
                    `Like Sharpe but only penalizes downside volatility: ${val}. Better for crypto as it doesn't penalize upside gains. Higher is better. Focuses on "bad" volatility (losses) vs "good" volatility (gains). <strong>Example:</strong> SPY's Sortino ratio is typically 0.8-1.2, higher than its Sharpe ratio since it doesn't penalize upside volatility.` :
                    `Like Sharpe but only penalizes downside volatility. Better for crypto as it doesn't penalize upside gains. Higher is better. Focuses on "bad" volatility (losses) vs "good" volatility (gains). <strong>Example:</strong> SPY's Sortino ratio is typically 0.8-1.2, higher than its Sharpe ratio since it doesn't penalize upside volatility.`
            },
            calmar: {
                title: 'Calmar Ratio',
                content: val ? 
                    `Return-to-drawdown metric: ${val}. Calculated as Annualized Return ÷ |Max Drawdown|. Higher is better. Shows how much return you get per unit of worst-case loss. Popular for hedge funds and trend-following strategies. >3 = excellent, >1 = good. <strong>Example:</strong> SPY's Calmar ratio is typically 0.2-0.4 over long periods. Successful hedge funds often achieve >1.0.` :
                    `Return-to-drawdown metric. Calculated as Annualized Return ÷ |Max Drawdown|. Higher is better. Shows how much return you get per unit of worst-case loss. Popular for hedge funds and trend-following strategies. >3 = excellent, >1 = good. <strong>Example:</strong> SPY's Calmar ratio is typically 0.2-0.4 over long periods. Successful hedge funds often achieve >1.0.`
            },
            betaSP500: {
                title: 'Beta to S&P 500',
                content: val ? 
                    `Measures sensitivity to S&P 500 movements: ${val}. Beta=1 means moves with market, >1 = more volatile than market, <1 = less volatile. Important: Beta assumes diversification. Single crypto assets are NOT diversified, so interpret cautiously. Best for portfolios. <strong>Example:</strong> SPY itself has Beta=1.0. Tech stocks often have Beta 1.2-1.5. Utilities typically have Beta 0.5-0.7.` :
                    `Measures sensitivity to S&P 500 movements. Beta=1 means moves with market, >1 = more volatile than market, <1 = less volatile. Important: Beta assumes diversification. Single crypto assets are NOT diversified, so interpret cautiously. <strong>Example:</strong> SPY itself has Beta=1.0. Tech stocks often have Beta 1.2-1.5. Utilities typically have Beta 0.5-0.7.`
            },
            betaBTC: {
                title: 'Beta to Bitcoin',
                content: val ? 
                    `Measures sensitivity to Bitcoin movements: ${val}. Beta=1 means moves with BTC, >1 = amplifies BTC moves, <1 = dampens BTC moves. Shows how much this asset follows Bitcoin's lead. Useful for understanding crypto market dynamics. <strong>Example:</strong> Similar to how tech stocks have Beta >1 to SPY, altcoins often have Beta >1 to Bitcoin.` :
                    `Measures sensitivity to Bitcoin movements. Beta=1 means moves with BTC, >1 = amplifies BTC moves, <1 = dampens BTC moves. Shows how much this asset follows Bitcoin's lead. Useful for understanding crypto market dynamics. <strong>Example:</strong> Similar to how tech stocks have Beta >1 to SPY, altcoins often have Beta >1 to Bitcoin.`
            },
            correlationSP500: {
                title: 'Correlation to S&P 500',
                content: val ? 
                    `Measures how closely this asset moves with the S&P 500 stock index. Range: -1 to +1. Current value: ${val}. +1 = perfect positive correlation (moves together), 0 = no relationship, -1 = perfect negative correlation (moves opposite). Lower correlation = better diversification potential. <strong>Example:</strong> SPY has correlation 1.0 to itself. Tech stocks typically 0.7-0.9 to SPY. Gold often 0.0-0.3 (low correlation).` :
                    `Measures how closely this asset moves with the S&P 500 stock index. Range: -1 to +1. +1 = perfect positive correlation (moves together), 0 = no relationship, -1 = perfect negative correlation (moves opposite). Lower correlation = better diversification potential. <strong>Example:</strong> SPY has correlation 1.0 to itself. Tech stocks typically 0.7-0.9 to SPY. Gold often 0.0-0.3 (low correlation).`
            },
            correlationBTC: {
                title: 'Correlation to Bitcoin',
                content: val ? 
                    `Measures how closely this asset moves with Bitcoin. Range: -1 to +1. Current value: ${val}. +1 = perfect positive correlation (moves together), 0 = no relationship, -1 = perfect negative correlation (moves opposite). Lower correlation = better diversification within crypto. <strong>Example:</strong> Similar to how different sectors have varying correlations to SPY, crypto assets have different correlations to Bitcoin.` :
                    `Measures how closely this asset moves with Bitcoin. Range: -1 to +1. +1 = perfect positive correlation (moves together), 0 = no relationship, -1 = perfect negative correlation (moves opposite). Lower correlation = better diversification within crypto. <strong>Example:</strong> Similar to how different sectors have varying correlations to SPY, crypto assets have different correlations to Bitcoin.`
            }
        };

        return tooltips[metric] || { title: 'Metric', content: 'Click for more details in the analysis below.' };
    }

    function attachInfoIconHandlers() {
        const infoIcons = document.querySelectorAll('.info-icon');
        
        infoIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                
                const metric = icon.dataset.metric;
                const value = icon.dataset.value;
                const timeframe = icon.dataset.timeframe || '1 year';
                
                // Remove any existing tooltips
                document.querySelectorAll('.metric-tooltip-popup').forEach(t => t.remove());
                
                // Create tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'metric-tooltip-popup';
                
                const content = getMetricTooltipContent(metric, value, timeframe);
                
                tooltip.innerHTML = `
                    <div class="tooltip-header">
                        <strong>${content.title}</strong>
                        <span class="tooltip-close">×</span>
                    </div>
                    <div class="tooltip-content">${content.content}</div>
                `;
                
                // Position tooltip near the icon
                document.body.appendChild(tooltip);
                
                const iconRect = icon.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // Position below the icon, centered
                let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
                let top = iconRect.bottom + 8;
                
                // Keep tooltip on screen
                if (left < 10) left = 10;
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }
                
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                
                // Close button handler
                tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
                    tooltip.remove();
                });
                
                // Close on outside click
                setTimeout(() => {
                    document.addEventListener('click', function closeTooltip(e) {
                        if (!tooltip.contains(e.target)) {
                            tooltip.remove();
                            document.removeEventListener('click', closeTooltip);
                        }
                    });
                }, 100);
            });
        });
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        errorDiv.style.display = 'block';
        
        // Scroll to error message so user can see it
        setTimeout(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    // Default tokens are already set in HTML (bitcoin, ethereum, blank)
    // No need to initialize - HTML has the correct structure

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
