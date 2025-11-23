document.addEventListener('DOMContentLoaded', async () => {
    // ========== HELPER FUNCTIONS (Module Scope) ==========
    
    // Helper function to check if input is in "TICKER Name" format
    function isTickerNameFormat(value) {
        if (!value) return false;
        const parts = value.trim().split(' ');
        // Check if it looks like "TICKER Name" (2+ words, first is short uppercase)
        return parts.length >= 2 && parts[0].length <= 10 && /^[A-Z]+$/.test(parts[0]);
    }
    
    // Format market cap for display
    function formatMarketCap(marketCap) {
        if (!marketCap || marketCap === 0) return 'N/A';
        if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
        if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
        if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
        return `$${marketCap.toLocaleString()}`;
    }

    // Format price for display
    function formatPrice(price) {
        if (!price || price === null) return 'N/A';
        if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        if (price >= 1) return `$${price.toFixed(2)}`;
        if (price >= 0.01) return `$${price.toFixed(4)}`;
        return `$${price.toFixed(6)}`;
    }

    // Shared dropdown positioning calculation
    function calculateDropdownPosition(inputRect, isMobile, dropdownMaxHeight, autocompleteDiv, inputElement) {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        autocompleteDiv.style.position = 'fixed';
        autocompleteDiv.style.zIndex = '10000';
        
        if (isMobile) {
            // Mobile: ensure dropdown is always visible in viewport
            if (inputRect.top < 0 || inputRect.bottom > viewportHeight) {
                // Input is out of view - scroll it into view first
                if (inputElement) {
                    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Return null to indicate async positioning needed
                    return null;
                }
            }
            
            // Calculate position ensuring it's always in viewport
            const safeInputBottom = Math.max(0, Math.min(inputRect.bottom, viewportHeight));
            const safeInputTop = Math.max(0, Math.min(inputRect.top, viewportHeight));
            const safeSpaceBelow = Math.max(0, viewportHeight - safeInputBottom);
            const safeSpaceAbove = Math.max(0, safeInputTop);
            
            let topPosition, maxHeight;
            
            if (safeSpaceBelow >= 200) {
                topPosition = safeInputBottom + 4;
                maxHeight = Math.min(dropdownMaxHeight, safeSpaceBelow - 20);
            } else if (safeSpaceAbove >= 200) {
                topPosition = Math.max(8, safeInputTop - Math.min(dropdownMaxHeight, safeSpaceAbove - 4));
                maxHeight = Math.min(dropdownMaxHeight, safeSpaceAbove - 20);
            } else {
                if (safeSpaceBelow > safeSpaceAbove) {
                    topPosition = safeInputBottom + 4;
                    maxHeight = Math.max(150, safeSpaceBelow - 20);
                } else {
                    topPosition = Math.max(8, safeInputTop - Math.min(dropdownMaxHeight, safeSpaceAbove - 4));
                    maxHeight = Math.max(150, safeSpaceAbove - 20);
                }
            }
            
            topPosition = Math.max(8, Math.min(topPosition, viewportHeight - 50));
            
            return {
                top: `${topPosition}px`,
                left: `${Math.max(12, inputRect.left)}px`,
                width: `${Math.min(inputRect.width, viewportWidth - 24)}px`,
                maxWidth: `${viewportWidth - 24}px`,
                maxHeight: `${maxHeight}px`
            };
        } else {
            // Desktop: align directly below input
            const spaceBelow = viewportHeight - inputRect.bottom;
            return {
                top: `${inputRect.bottom + 4}px`,
                left: `${inputRect.left}px`,
                width: `${inputRect.width}px`,
                maxWidth: `${inputRect.width}px`,
                maxHeight: `${Math.min(dropdownMaxHeight, spaceBelow - 20)}px`,
                right: 'auto',
                bottom: 'auto',
                margin: '0',
                transform: 'none'
            };
        }
    }

    // Apply calculated position to dropdown element
    function applyDropdownPosition(autocompleteDiv, position) {
        if (!position) return;
        Object.keys(position).forEach(key => {
            autocompleteDiv.style[key] = position[key];
        });
    }

    // Cleanup autocomplete dropdown
    function cleanupAutocomplete(autocompleteDiv) {
        if (autocompleteDiv) {
            if (autocompleteDiv._cleanup) {
                autocompleteDiv._cleanup();
            }
            autocompleteDiv.remove();
            return null;
        }
        return null;
    }

    // Chart instances storage
    const chartInstances = new Map();

    // Create or update price chart for an asset
    async function updateAssetChart(inputId, coinId) {
        if (!coinId || !coinId.trim()) {
            // Clear chart if coin ID is empty
            const chartId = `${inputId}-chart`;
            const chartInstance = chartInstances.get(chartId);
            if (chartInstance) {
                chartInstance.destroy();
                chartInstances.delete(chartId);
            }
            // Clear price and market cap display
            const priceDisplay = document.getElementById(`${inputId}-price`);
            if (priceDisplay) {
                priceDisplay.textContent = '';
                priceDisplay.style.display = 'none';
            }
            const marketCapDisplay = document.getElementById(`${inputId}-marketcap`);
            if (marketCapDisplay) {
                marketCapDisplay.textContent = '';
                marketCapDisplay.style.display = 'none';
            }
            // Clear chart labels
            const chartLabelsContainer = document.getElementById(`${inputId}-chart-labels`);
            if (chartLabelsContainer) {
                chartLabelsContainer.innerHTML = '';
                chartLabelsContainer.style.display = 'none';
            }
            return;
        }

        const chartId = `${inputId}-chart`;
        const canvas = document.getElementById(chartId);
        if (!canvas) return;

        try {
            // Fetch 1-year price history
            const response = await fetch(`/api/coin-history/${encodeURIComponent(coinId)}`);
            if (!response.ok) {
                // If fetch fails, clear existing chart
                const existingChart = chartInstances.get(chartId);
                if (existingChart) {
                    existingChart.destroy();
                    chartInstances.delete(chartId);
                }
                return;
            }

            const data = await response.json();
            if (!data.prices || data.prices.length === 0) {
                return;
            }

            // Update current price and market cap display
            const priceDisplay = document.getElementById(`${inputId}-price`);
            if (priceDisplay && data.currentPrice) {
                priceDisplay.textContent = formatPrice(data.currentPrice);
                priceDisplay.style.display = 'block';
            }
            
            const marketCapDisplay = document.getElementById(`${inputId}-marketcap`);
            if (marketCapDisplay && data.marketCap) {
                marketCapDisplay.textContent = formatMarketCap(data.marketCap);
                marketCapDisplay.style.display = 'inline';
            } else if (marketCapDisplay) {
                marketCapDisplay.textContent = '';
                marketCapDisplay.style.display = 'none';
            }

            // Update chart labels with high/low (will be positioned after chart renders)
            const chartLabelsContainer = document.getElementById(`${inputId}-chart-labels`);
            if (chartLabelsContainer && data.highPrice && data.lowPrice) {
                chartLabelsContainer.innerHTML = `
                    <span class="chart-label-high">H: ${formatPrice(data.highPrice)}</span>
                    <span class="chart-label-low">L: ${formatPrice(data.lowPrice)}</span>
                `;
                chartLabelsContainer.style.display = 'block';
            }

            // Process data: extract prices and normalize to percentage change
            const prices = data.prices.map(p => p[1]);
            const firstPrice = prices[0];
            const normalizedPrices = prices.map(p => ((p - firstPrice) / firstPrice) * 100);

            // Find indices of high and low prices in the original data
            const highIndex = prices.findIndex(p => p === data.highPrice);
            const lowIndex = prices.findIndex(p => p === data.lowPrice);

            // Use more data points for better detail - sample every 2-3 days instead of every 30
            const labels = [];
            const chartData = [];
            const step = Math.max(1, Math.floor(data.prices.length / 120)); // ~120 data points for more detail
            const chartIndices = []; // Track original indices for each chart point
            
            for (let i = 0; i < data.prices.length; i += step) {
                const date = new Date(data.prices[i][0]);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                chartData.push(normalizedPrices[i]);
                chartIndices.push(i);
            }

            // Find chart indices for high and low
            const highChartIndex = chartIndices.findIndex(idx => idx === highIndex);
            const lowChartIndex = chartIndices.findIndex(idx => idx === lowIndex);
            
            // If exact match not found, find closest
            const highChartIndexFinal = highChartIndex !== -1 ? highChartIndex : 
                chartIndices.reduce((closest, idx, i) => 
                    Math.abs(idx - highIndex) < Math.abs(chartIndices[closest] - highIndex) ? i : closest, 0);
            const lowChartIndexFinal = lowChartIndex !== -1 ? lowChartIndex : 
                chartIndices.reduce((closest, idx, i) => 
                    Math.abs(idx - lowIndex) < Math.abs(chartIndices[closest] - lowIndex) ? i : closest, 0);

            // Destroy existing chart if it exists
            const existingChart = chartInstances.get(chartId);
            if (existingChart) {
                existingChart.destroy();
            }

            // Determine color based on performance
            const isPositive = normalizedPrices[normalizedPrices.length - 1] >= 0;
            const chartColor = isPositive ? 'rgba(63, 185, 80, 0.8)' : 'rgba(248, 81, 73, 0.8)';
            const bgColor = isPositive ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)';

            // Create new chart
            const chartInstance = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Price Change (%)',
                        data: chartData,
                        borderColor: chartColor,
                        backgroundColor: bgColor,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1, // Reduced from 0.4 for less smoothness, more detail
                        pointRadius: 0,
                        pointHoverRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            display: false,
                            beginAtZero: false,
                            // Zoom in by reducing padding - use most of the vertical space
                            min: function(context) {
                                const chart = context.chart;
                                const data = chart.data.datasets[0].data;
                                const min = Math.min(...data);
                                const max = Math.max(...data);
                                const range = max - min;
                                // Use only 5% padding instead of default ~10-15%
                                return min - (range * 0.05);
                            },
                            max: function(context) {
                                const chart = context.chart;
                                const data = chart.data.datasets[0].data;
                                const min = Math.min(...data);
                                const max = Math.max(...data);
                                const range = max - min;
                                // Use only 5% padding instead of default ~10-15%
                                return max + (range * 0.05);
                            }
                        }
                    },
                    interaction: {
                        intersect: false
                    },
                    animation: {
                        onComplete: () => {
                            // Position high/low labels after chart is rendered
                            if (chartLabelsContainer && data.highPrice && data.lowPrice) {
                                const chartWidth = canvas.width;
                                const chartHeight = canvas.height;
                                
                                // Calculate X positions as percentages
                                const highXPercent = (highChartIndexFinal / (chartData.length - 1)) * 100;
                                const lowXPercent = (lowChartIndexFinal / (chartData.length - 1)) * 100;
                                
                                // Get Y values from chart data (the actual values plotted)
                                const highYValue = chartData[highChartIndexFinal];
                                const lowYValue = chartData[lowChartIndexFinal];
                                
                                // Find min/max from chart data for accurate scaling
                                const chartMin = Math.min(...chartData);
                                const chartMax = Math.max(...chartData);
                                const chartRange = chartMax - chartMin || 1; // Avoid division by zero
                                
                                // Calculate Y positions (inverted: 0% = top, 100% = bottom)
                                // Add padding to keep labels visible within chart bounds
                                const padding = 8; // percentage padding from edges
                                const highYPercent = Math.max(padding, 100 - ((highYValue - chartMin) / chartRange) * (100 - padding * 2) - padding);
                                const lowYPercent = Math.min(100 - padding, 100 - ((lowYValue - chartMin) / chartRange) * (100 - padding * 2) + padding);
                                
                                // Update labels with positioning
                                const highLabel = chartLabelsContainer.querySelector('.chart-label-high');
                                const lowLabel = chartLabelsContainer.querySelector('.chart-label-low');
                                
                                if (highLabel) {
                                    highLabel.style.position = 'absolute';
                                    highLabel.style.left = `${highXPercent}%`;
                                    highLabel.style.top = `${highYPercent}%`;
                                    highLabel.style.transform = 'translate(-50%, -100%)';
                                    highLabel.style.marginTop = '-2px';
                                }
                                
                                if (lowLabel) {
                                    lowLabel.style.position = 'absolute';
                                    lowLabel.style.left = `${lowXPercent}%`;
                                    lowLabel.style.top = `${lowYPercent}%`;
                                    lowLabel.style.transform = 'translate(-50%, 0)';
                                    lowLabel.style.marginTop = '2px';
                                }
                                
                                // Ensure container is positioned correctly
                                chartLabelsContainer.style.position = 'absolute';
                                chartLabelsContainer.style.top = '0';
                                chartLabelsContainer.style.left = '0';
                                chartLabelsContainer.style.width = '100%';
                                chartLabelsContainer.style.height = '100%';
                            }
                        }
                    }
                }
            });

            chartInstances.set(chartId, chartInstance);
        } catch (error) {
            // Silently fail - chart is optional
            const existingChart = chartInstances.get(chartId);
            if (existingChart) {
                existingChart.destroy();
                chartInstances.delete(chartId);
            }
        }
    }

    // ========== MAIN CODE ==========
    
    // Handle initial page load screen
    const initialLoader = document.getElementById('initialLoader');
    const mainContent = document.getElementById('mainContent');
    const enterButton = document.getElementById('enterButton');
    
    // Function to completely remove loader and show main content
    function removeLoaderAndShowContent() {
        
        // Show main content first
        if (mainContent) {
            mainContent.style.opacity = '1';
            mainContent.style.visibility = 'visible';
            mainContent.style.display = 'block';
            mainContent.style.zIndex = '1';
            
            // Trigger header animation by restarting it
            const header = mainContent.querySelector('.card h2');
            if (header) {
                // Reset animation to trigger it
                header.style.animation = 'none';
                // Force reflow
                void header.offsetWidth;
                // Reapply animation
                header.style.animation = 'slideInDown 0.8s ease-out 0.2s forwards';
            }
        }
        
        // Remove loader completely from DOM
        if (initialLoader) {
            // Set all hiding styles
            initialLoader.style.display = 'none';
            initialLoader.style.visibility = 'hidden';
            initialLoader.style.opacity = '0';
            initialLoader.style.pointerEvents = 'none';
            initialLoader.style.zIndex = '-1';
            initialLoader.classList.add('hidden');
            
            // Force remove from DOM immediately
            if (initialLoader.parentNode) {
                initialLoader.remove();
            }
        }
        
        // Scroll to top and then to inputs
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => {
            const inputsSection = document.querySelector('.card');
            if (inputsSection) {
                inputsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
    
    // Show loader immediately
    if (initialLoader) {
        initialLoader.style.display = 'flex';
        initialLoader.classList.remove('hidden');
        initialLoader.style.zIndex = '10000';
        initialLoader.style.visibility = 'visible';
        initialLoader.style.opacity = '1';
    }
    
    // Hide main content initially
    if (mainContent) {
        mainContent.style.opacity = '0';
        mainContent.style.visibility = 'hidden';
    }
    
    // Hide enter button initially with inline styles to override CSS
    if (enterButton) {
        enterButton.classList.add('hidden');
        enterButton.style.display = 'none';
        enterButton.style.opacity = '0';
        enterButton.style.visibility = 'hidden';
        enterButton.style.pointerEvents = 'none';
    }
    
    // Simulate loading progress - complete in 2 seconds
    const progressBar = document.querySelector('.loader-progress-bar');
    let progressComplete = false;
    let progressInterval = null;
    
    const showEnterButton = () => {
        if (enterButton && !progressComplete) {
            progressComplete = true;
            
            // Remove hidden class
            enterButton.classList.remove('hidden');
            
            // Force show with inline styles to override CSS !important
            enterButton.style.display = 'block';
            enterButton.style.opacity = '1';
            enterButton.style.visibility = 'visible';
            enterButton.style.pointerEvents = 'auto';
            enterButton.style.zIndex = '10001';
            
            // Ensure button is centered
            enterButton.style.marginLeft = 'auto';
            enterButton.style.marginRight = 'auto';
            enterButton.style.marginTop = '40px';
            
            // Add animation class if needed
            enterButton.style.animation = 'enterButtonAppear 0.6s ease forwards';
        }
    };
    
    // Animate progress bar with error handling
    if (progressBar) {
        let progress = 0;
        const targetProgress = 100;
        const duration = 2000; // 2 seconds
        const intervalTime = 50; // Update every 50ms
        const increment = (targetProgress / duration) * intervalTime;
        
        try {
            progressInterval = setInterval(() => {
            progress += increment;
            if (progress >= targetProgress) {
                progress = targetProgress;
                    clearInterval(progressInterval);
                progressBar.style.width = '100%';
                // Show enter button when progress completes
                showEnterButton();
            } else {
                progressBar.style.width = `${progress}%`;
            }
        }, intervalTime);
        } catch (error) {
            // Fallback: show button immediately on error
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            showEnterButton();
        }
    } else {
        // If progress bar doesn't exist, show button after short delay
        setTimeout(() => {
            showEnterButton();
        }, 500);
    }
    
    // Multiple fallback mechanisms to ensure button shows
    // Fallback 1: After 2.2 seconds
    setTimeout(() => {
        if (!progressComplete) {
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            showEnterButton();
        }
    }, 2200);
    
    // Fallback 2: After 3 seconds (ultimate fallback)
    setTimeout(() => {
        if (!progressComplete || enterButton.classList.contains('hidden')) {
            if (progressBar) {
                progressBar.style.width = '100%';
            }
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            // Force show regardless of progressComplete flag
            if (enterButton) {
                enterButton.classList.remove('hidden');
                enterButton.style.display = 'block';
                enterButton.style.opacity = '1';
                enterButton.style.visibility = 'visible';
                enterButton.style.pointerEvents = 'auto';
                enterButton.style.zIndex = '10001';
                // Ensure button is centered
                enterButton.style.marginLeft = 'auto';
                enterButton.style.marginRight = 'auto';
                enterButton.style.marginTop = '40px';
            }
        }
    }, 3000);
    
    // Enter button click handler
    if (enterButton) {
        enterButton.addEventListener('click', () => {
            removeLoaderAndShowContent();
        });
    }
    
    // Keyboard support: Enter key to dismiss loader
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && initialLoader && !initialLoader.classList.contains('hidden')) {
            removeLoaderAndShowContent();
        }
    });
    
    // Click outside loader to dismiss (backup)
    if (initialLoader) {
        initialLoader.addEventListener('click', (e) => {
            // Only dismiss if clicking on the loader background, not on content
            if (e.target === initialLoader) {
                removeLoaderAndShowContent();
            }
        });
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
    // Removed: Add Another Asset button functionality (limited to 3 assets)
    // const addTokenBtn = document.getElementById('addTokenBtn');
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
            <div class="form-group flowy-input-group">
                <div class="asset-display-wrapper">
                    <div class="asset-logo-container">
                        <img class="asset-logo" id="token${tokenIndex}-logo" src="" alt="" style="display: none;">
                    </div>
                                <div class="asset-input-container">
                                    <div class="token-input-wrapper flowy-wrapper">
                                        <input type="text" class="token-input flowy-input" id="token${tokenIndex}" name="token${tokenIndex}" placeholder="Enter asset name or symbol..." required>
                    <button type="button" class="btn-remove-token" aria-label="Clear input">×</button>
                </div>
                                </div>
                                <div class="asset-chart-section" id="token${tokenIndex}-chart-section" style="display: none;">
                                    <div class="asset-chart-container">
                                        <div class="chart-labels" id="token${tokenIndex}-chart-labels"></div>
                                        <canvas id="token${tokenIndex}-chart" class="asset-chart"></canvas>
                                    </div>
                                    <div class="asset-price-wrapper">
                                        <span class="asset-price-label">Current Price</span>
                                        <span class="asset-price-chart" id="token${tokenIndex}-price"></span>
                                    </div>
                                </div>
                                </div>
                </div>
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
                inputField.removeAttribute('data-coin-id'); // Clear stored coin ID
                updateAssetDisplay(inputField).catch(() => {}); // Clear logo and name
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
            
            // Add focus, blur, and backspace handlers for new inputs
            newInput.setAttribute('data-focus-handler-added', 'true');
            let previousValue = ''; // Store previous value for restoration
            
            // Helper function to check if asset is confirmed (logo is visible)
            const isAssetConfirmed = (inputElement) => {
                const inputId = inputElement.id;
                const logoImg = document.getElementById(`${inputId}-logo`);
                return logoImg && logoImg.style.display !== 'none' && logoImg.src;
            };
            
            // Click/touch handler: clear input on single click/touch to allow fresh typing
            // Always clear on click, even if asset is confirmed - user explicitly wants to edit
            // Use both click and touchstart for better mobile support
            const handleInputClear = (e) => {
                const value = e.target.value.trim();
                
                // Only clear if there's a value and user clicked (not selecting text)
                // Check if there's a text selection - if so, don't clear
                const selectionStart = e.target.selectionStart;
                const selectionEnd = e.target.selectionEnd;
                const hasSelection = selectionStart !== selectionEnd;
                
                if (value && !hasSelection) {
                    // Store previous value for potential restoration
                    previousValue = value;
                    
                    // Set flag to prevent autocomplete from triggering with old value
                    e.target.setAttribute('data-clearing', 'true');
                    
                    // Clear the input immediately
                    e.target.value = '';
                    
                    // Clear any existing autocomplete dropdown
                    const existingDropdown = document.querySelector('.autocomplete-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    
                    // Remove the flag after a brief delay to allow fresh typing
                    setTimeout(() => {
                        e.target.removeAttribute('data-clearing');
                    }, 100);
                    
                    // Don't remove data-coin-id - keep it for analyze button
                }
            };
            
            // Use mousedown instead of click to fire before focus event
            // Also use capture phase to ensure it runs first
            newInput.addEventListener('mousedown', handleInputClear, { capture: true });
            newInput.addEventListener('touchstart', handleInputClear, { passive: true, capture: true });
            
            newInput.addEventListener('focus', (e) => {
                const value = e.target.value.trim();
                // Don't clear if asset is confirmed (logo is showing)
                if (isAssetConfirmed(e.target)) {
                    return; // Keep the value locked when asset is confirmed
                }
                
                // Only clear on focus if it wasn't already cleared by click/touch
                // Check if we just cleared it (data-clearing flag)
                if (e.target.getAttribute('data-clearing') === 'true') {
                    return; // Already cleared by click/touch handler
                }
                
                // Store previous value for potential restoration
                if (value) {
                    previousValue = value;
                    
                    // Set flag to prevent autocomplete from triggering with old value
                    e.target.setAttribute('data-clearing', 'true');
                    
                    e.target.value = '';
                    
                    // Clear any existing autocomplete dropdown
                    const existingDropdown = document.querySelector('.autocomplete-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    
                    // Remove the flag after a brief delay
                    setTimeout(() => {
                        e.target.removeAttribute('data-clearing');
                    }, 100);
                    
                    // Don't remove data-coin-id - keep it for analyze button
                }
            });
            
            newInput.addEventListener('blur', async (e) => {
                const value = e.target.value.trim();
                const coinId = e.target.getAttribute('data-coin-id');
                
                // If asset is confirmed (logo showing), always restore ticker and name
                if (isAssetConfirmed(e.target) && coinId) {
                    // First try direct name mapping based on coinId
                    const nameMap = {
                        'xrp': 'Ripple',
                        'ripple': 'Ripple',
                        'bnb': 'Binance Coin',
                        'binancecoin': 'Binance Coin',
                        'usdt': 'Tether',
                        'tether': 'Tether',
                        'usdc': 'USD Coin',
                        'usd-coin': 'USD Coin',
                        'dai': 'Dai',
                        'dai-stablecoin': 'Dai',
                        'busd': 'Binance USD',
                        'binance-usd': 'Binance USD'
                    };
                    const mappedName = nameMap[coinId.toLowerCase()];
                    if (mappedName) {
                        e.target.value = mappedName;
                        previousValue = ''; // Clear stored value
                        return;
                    }
                    
                    // Fallback: fetch coin data to get name
                    try {
                        const coinResponse = await fetch(`/api/coin/${encodeURIComponent(coinId)}`);
                        if (coinResponse.ok) {
                            const coinData = await coinResponse.json();
                            if (coinData && coinData.name) {
                                // If name equals symbol, use proper name mapping
                                let displayName = coinData.name;
                                if (coinData.symbol && coinData.name.toUpperCase() === coinData.symbol.toUpperCase()) {
                                    displayName = nameMap[coinData.id.toLowerCase()] || nameMap[coinData.symbol.toLowerCase()] || coinData.name;
                                }
                                e.target.value = displayName;
                                previousValue = ''; // Clear stored value
                                return;
                            }
                        }
                    } catch (error) {
                        // If fetch fails, try to restore from previousValue
                    }
                    
                    // Fallback: restore from previousValue if available
                    if (previousValue) {
                        e.target.value = previousValue;
                        previousValue = ''; // Clear stored value
                        return;
                    }
                }
                
                // If input is empty but we have a coin ID, restore the previous value
                if (!value && coinId && previousValue) {
                    e.target.value = previousValue;
                    previousValue = ''; // Clear stored value
                } else if (!value && !coinId) {
                    // If no value and no coin ID, clear everything
                    previousValue = '';
                }
            });
            
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.selectionStart && !e.target.selectionEnd) {
                    const value = e.target.value.trim();
                    if (isTickerNameFormat(value)) {
                        e.preventDefault();
                        previousValue = value; // Store for potential restoration
                        e.target.value = '';
                        // Don't remove data-coin-id - keep it for analyze button
                        // Don't clear logo and chart - they should persist
                    }
                }
            });
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
        
        // Removed: Add button visibility logic (limited to 3 assets)
        // if (tokenGroups.length >= 5) {
        //     addTokenBtn.style.display = 'none';
        // } else {
        //     addTokenBtn.style.display = 'flex';
        // }
    }

    // Removed: Add event listener to "Add Token" button (limited to 3 assets)
    // addTokenBtn.addEventListener('click', addTokenInput);

    // Initialize remove button visibility
    updateRemoveButtons();

    // Function to collect all token IDs from the form
    function collectTokens() {
        const tokenInputs = tokensContainer.querySelectorAll('.token-input');
        const tokens = [];
        tokenInputs.forEach(input => {
            const value = input.value.trim();
            // Check if there's a stored coin ID (from autocomplete, dice button, or default values)
            // Use coin ID even if input is empty (user may have backspaced but not confirmed new asset)
            const coinId = input.getAttribute('data-coin-id');
            if (coinId) {
                tokens.push(coinId);
            } else if (value) {
                // Fallback: extract from "TICKER Name" format or use original value
                // Try to extract just the first word (ticker) if it looks like "TICKER Name"
                const parts = value.split(' ');
                if (parts.length > 1 && parts[0].length <= 10) {
                    // Likely "TICKER Name" format, use the ticker part
                    tokens.push(parts[0].toLowerCase());
                } else {
                    tokens.push(value.toLowerCase());
                }
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

    // Function to update default value styling
    function updateDefaultValueStyle(input) {
        const value = input.value.trim().toLowerCase();
        if (value === 'bitcoin' || value === 'ethereum') {
            input.classList.add('default-value');
        } else {
            input.classList.remove('default-value');
        }
    }

    // Autocomplete functionality for token inputs
    function setupAutocomplete(input) {
        let autocompleteDiv = null;
        let searchTimeout = null;

        // Check initial value and update style
        updateDefaultValueStyle(input);

        input.addEventListener('input', async (e) => {
            // Skip autocomplete if value was set programmatically (e.g., by random crypto button)
            if (e.target.getAttribute('data-programmatic-set') === 'true') {
                return;
            }
            
            // Skip autocomplete if input is being cleared (to prevent showing suggestions for old value)
            if (e.target.getAttribute('data-clearing') === 'true') {
                return;
            }
            
            const query = e.target.value.trim().toLowerCase();
            
            // Update default value styling
            updateDefaultValueStyle(e.target);
            
            // Clear existing autocomplete and cleanup listeners
            autocompleteDiv = cleanupAutocomplete(autocompleteDiv);

            // Clear timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // Don't search if query is too short or empty
            if (query.length < 1) {
                return;
            }

            // Show loading state immediately after 1st character for instant feedback
            if (query.length >= 1 && (!autocompleteDiv || !autocompleteDiv.classList.contains('autocomplete-loading'))) {
                // Remove existing dropdown if it exists
                autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
                
                autocompleteDiv = document.createElement('div');
                autocompleteDiv.className = 'autocomplete-dropdown autocomplete-loading';
                const loadingItem = document.createElement('div');
                loadingItem.className = 'autocomplete-item autocomplete-loading-item';
                loadingItem.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <div class="autocomplete-spinner"></div>
                        <span>Loading suggestions...</span>
                    </div>
                `;
                autocompleteDiv.appendChild(loadingItem);
                
                // Position dropdown immediately with proper calculation
                const positionDropdown = () => {
                const inputRect = input.getBoundingClientRect();
                const isMobile = window.innerWidth <= 768;
                    const dropdownMaxHeight = 300;
                    
                    const position = calculateDropdownPosition(inputRect, isMobile, dropdownMaxHeight, autocompleteDiv, input);
                    
                    if (position === null) {
                        // Async positioning needed (mobile scroll case)
                        setTimeout(() => {
                            const newInputRect = input.getBoundingClientRect();
                            const newPosition = calculateDropdownPosition(newInputRect, isMobile, dropdownMaxHeight, autocompleteDiv, input);
                            if (newPosition && autocompleteDiv) {
                                applyDropdownPosition(autocompleteDiv, newPosition);
                            }
                        }, 300);
                } else {
                        applyDropdownPosition(autocompleteDiv, position);
                    }
                };
                
                positionDropdown();
                
                // Recalculate position on scroll/resize
                const updatePosition = () => {
                    if (autocompleteDiv && autocompleteDiv.classList.contains('autocomplete-loading')) {
                        positionDropdown();
                    }
                };
                window.addEventListener('scroll', updatePosition, { passive: true });
                window.addEventListener('resize', updatePosition, { passive: true });
                
                // Store cleanup function
                autocompleteDiv._cleanup = () => {
                    window.removeEventListener('scroll', updatePosition);
                    window.removeEventListener('resize', updatePosition);
                };
                
                // Always append to body for fixed positioning to work correctly
                // This ensures the dropdown is positioned relative to viewport, not parent containers
                document.body.appendChild(autocompleteDiv);
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
                            
                            item.addEventListener('click', async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Store coin ID and update display
                                input.setAttribute('data-coin-id', coin.id);
                                await updateAssetDisplay(input, coin);
                                
                                // Immediately close dropdown after selection
                                    autocompleteDiv.style.display = 'none'; // Hide immediately
                                autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
                                
                                // Clear any pending search timeouts
                                if (searchTimeout) {
                                    clearTimeout(searchTimeout);
                                    searchTimeout = null;
                                }
                                
                                // Remove any existing click listeners
                                const existingListeners = document.querySelectorAll('.autocomplete-dropdown');
                                existingListeners.forEach(dropdown => dropdown.remove());
                                
                                // Don't override the value - updateAssetDisplay already set it correctly
                                // Just trigger blur to close dropdowns
                                setTimeout(() => {
                                    input.blur(); // Trigger blur to close any remaining dropdowns and lock value
                                }, 10);
                            });
                            autocompleteDiv.appendChild(item);
                        });

                        // Position dropdown - recalculate position when results load
                        const positionDropdownWithResults = () => {
                            const inputRect = input.getBoundingClientRect();
                            const isMobile = window.innerWidth <= 768;
                            const dropdownMaxHeight = 300;
                            
                            const position = calculateDropdownPosition(inputRect, isMobile, dropdownMaxHeight, autocompleteDiv, input);
                            
                            if (position === null) {
                                // Async positioning needed (mobile scroll case)
                                setTimeout(() => {
                                    const newInputRect = input.getBoundingClientRect();
                                    const newPosition = calculateDropdownPosition(newInputRect, isMobile, dropdownMaxHeight, autocompleteDiv, input);
                                    if (newPosition && autocompleteDiv) {
                                        applyDropdownPosition(autocompleteDiv, newPosition);
                                    }
                                }, 300);
                            } else {
                                applyDropdownPosition(autocompleteDiv, position);
                            }
                        };
                        
                        positionDropdownWithResults();
                        
                        // Update position on scroll/resize for results dropdown
                        const updateResultsPosition = () => {
                            if (autocompleteDiv && !autocompleteDiv.classList.contains('autocomplete-loading')) {
                                positionDropdownWithResults();
                            }
                        };
                        window.addEventListener('scroll', updateResultsPosition, { passive: true });
                        window.addEventListener('resize', updateResultsPosition, { passive: true });
                        
                        // Store cleanup function
                        if (autocompleteDiv._cleanup) {
                            autocompleteDiv._cleanup();
                        }
                        autocompleteDiv._cleanup = () => {
                            window.removeEventListener('scroll', updateResultsPosition);
                            window.removeEventListener('resize', updateResultsPosition);
                        };

                        // Always append to body for fixed positioning to work correctly
                        // This ensures the dropdown is positioned relative to viewport, not parent containers
                        if (!document.body.contains(autocompleteDiv)) {
                            document.body.appendChild(autocompleteDiv);
                        }

                        // Close on outside click - use capture phase for better reliability
                        const closeHandler = (e) => {
                            if (autocompleteDiv && !autocompleteDiv.contains(e.target) && e.target !== input && !input.contains(e.target)) {
                                autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
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
                        // No results - show message instead of removing
                        if (autocompleteDiv && autocompleteDiv.classList.contains('autocomplete-loading')) {
                            autocompleteDiv.innerHTML = '';
                            autocompleteDiv.classList.remove('autocomplete-loading');
                            const noResultsItem = document.createElement('div');
                            noResultsItem.className = 'autocomplete-item autocomplete-loading-item';
                            noResultsItem.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No results found. Try typing more characters.</div>';
                            autocompleteDiv.appendChild(noResultsItem);
                        } else if (autocompleteDiv) {
                            // If not loading, remove it
                            autocompleteDiv.remove();
                            autocompleteDiv = null;
                        }
                    }
                } catch (error) {
                    // Remove loading state on error
                    autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
                }
            }, 300); // Reduced to 300ms for faster response
        });

        // Remove autocomplete when input loses focus (after a delay to allow clicks)
        input.addEventListener('blur', () => {
            // Update default value styling on blur
            updateDefaultValueStyle(input);
            
            setTimeout(() => {
                autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
            }, 150); // Reduced delay for better mobile responsiveness
        });
        
        // Also close on input change if value is cleared
        input.addEventListener('input', (e) => {
            if (!e.target.value.trim() && autocompleteDiv) {
                autocompleteDiv = cleanupAutocomplete(autocompleteDiv);
            }
        });
    }

    // Random crypto button functionality - cycles through list without repeating
    // Ordered: ripple, binancecoin, zcash, monero, solana, litecoin, dogecoin, uniswap, chainlink
    const randomCryptos = ['ripple', 'binancecoin', 'zcash', 'monero', 'solana', 'litecoin', 'dogecoin', 'uniswap', 'chainlink'];
    let randomCryptoIndex = -1; // Start at -1 so first click gets index 0
    let diceButtonProcessing = false; // Lock to prevent multiple simultaneous clicks
    
    // Random stock button functionality - cycles through xStock tokens
    // xStock tokens are tokenized equities available on CoinGecko
    // Note: CoinGecko IDs may need verification - these are common patterns
    const randomStocks = ['nvidia-xstock', 'apple-xstock', 'tesla-xstock', 'microsoft-xstock', 'amazon-xstock', 'meta-xstock', 'alphabet-xstock', 'coinbase-xstock', 'netflix-xstock', 'robinhood-xstock', 'spy-xstock', 'microstrategy-xstock'];
    let randomStockIndex = 0; // Track current position in rotation
    let stockDiceButtonProcessing = false; // Lock to prevent multiple simultaneous clicks
    
    // Get random crypto button once (will be used later for scroll prompt too)
    // Use a function to ensure button is available when called
    function setupRandomCryptoButton() {
    const randomCryptoBtn = document.getElementById('randomCryptoBtn');
        if (!randomCryptoBtn) {
            // Retry after a short delay in case DOM isn't ready
            setTimeout(setupRandomCryptoButton, 100);
            return;
        }
        
    if (randomCryptoBtn) {
        // Use a more robust click handler
        randomCryptoBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent multiple simultaneous clicks
            if (diceButtonProcessing) {
                return;
            }
            diceButtonProcessing = true;
            
            try {
            // Get next crypto in rotation (cycles through list)
            // Move to next index FIRST, then get the crypto (ensures we don't repeat)
            randomCryptoIndex = (randomCryptoIndex + 1) % randomCryptos.length;
            const randomCrypto = randomCryptos[randomCryptoIndex];
            
            // Get the third input (token2)
            const token2Input = document.getElementById('token2');
            if (!token2Input) {
                return;
            }
            
            // Close any existing autocomplete dropdowns first
            const existingDropdown = document.querySelector('.autocomplete-dropdown');
            if (existingDropdown) {
                existingDropdown.remove();
            }
            
            // Set a flag to prevent autocomplete from triggering (set BEFORE any value changes)
            token2Input.setAttribute('data-programmatic-set', 'true');
            
            // Set the value directly - use native setter to ensure it's properly set
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(token2Input, randomCrypto);
            
            // Also set via property for compatibility
                token2Input.value = randomCrypto;
            
            // Verify the value was set correctly before proceeding
            if (token2Input.value.toLowerCase() !== randomCrypto.toLowerCase()) {
                token2Input.value = randomCrypto; // Force set again
            }
            
            // Update default value styling
            updateDefaultValueStyle(token2Input);
            
            // Clear display immediately to prevent showing stale data
            const token2Logo = document.getElementById('token2-logo');
            const token2Info = document.getElementById('token2-info');
            const token2Ticker = document.getElementById('token2-ticker');
            const token2Name = document.getElementById('token2-name');
            if (token2Logo) {
                token2Logo.style.display = 'none';
                token2Logo.src = '';
            }
            if (token2Info) {
                token2Info.style.display = 'none';
            }
            if (token2Ticker) {
                token2Ticker.textContent = '';
            }
            if (token2Name) {
                token2Name.textContent = '';
            }
            
            // Small delay to ensure value is fully set before fetching display data
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Update logo and name display - WAIT for it to complete to ensure correct data
            // Double-check the value is still correct before updating
            const currentValue = token2Input.value.trim().toLowerCase();
            if (currentValue === randomCrypto.toLowerCase()) {
                // Store coin ID before updating display
                token2Input.setAttribute('data-coin-id', randomCrypto);
                await updateAssetDisplay(token2Input);
                
                // No need for additional setTimeout - updateAssetDisplay handles name mapping correctly
            } else {
            }
            
            // Trigger change event (but NOT input event to avoid autocomplete)
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            token2Input.dispatchEvent(changeEvent);
            
            // Remove the flag after events are dispatched
            setTimeout(() => {
                token2Input.removeAttribute('data-programmatic-set');
            }, 200);
                
                // Add a brief highlight animation
                token2Input.style.animation = 'none';
                setTimeout(() => {
                    token2Input.style.animation = 'highlightPulse 0.6s ease';
                }, 10);
                
                // Focus the input
                setTimeout(() => {
                    token2Input.focus();
                }, 100);
            
            // Scroll prompt removed
            } finally {
                // Reset lock after a delay to allow async operations to complete
                setTimeout(() => {
                    diceButtonProcessing = false;
                }, 1000);
            }
        }, { capture: true }); // Use capture phase to ensure it fires
    }
    }
    
    // Call the setup function immediately
    setupRandomCryptoButton();
    
    // Also retry after a delay to ensure it's set up even if DOM loads late
    setTimeout(setupRandomCryptoButton, 500);
    
    // Random stock button functionality - similar to crypto dice
    function setupRandomStockButton() {
        const randomStockBtn = document.getElementById('randomStockBtn');
        if (!randomStockBtn) {
            setTimeout(setupRandomStockButton, 100);
            return;
        }
        
        if (randomStockBtn) {
            randomStockBtn.addEventListener('click', async function(e) {
                // Don't trigger if clicking the info icon
                if (e.target && e.target.classList.contains('info-icon-stock')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent multiple simultaneous clicks
                if (stockDiceButtonProcessing) {
                    return;
                }
                stockDiceButtonProcessing = true;
                
                try {
                    // Get next stock in rotation (cycles through list)
                    const randomStock = randomStocks[randomStockIndex];
                    // Move to next index, wrap around if at end
                    randomStockIndex = (randomStockIndex + 1) % randomStocks.length;
                    
                    // Get the third input (token2)
                    const token2Input = document.getElementById('token2');
                    if (!token2Input) {
                        return;
                    }
                    
                    // Close any existing autocomplete dropdowns first
                    const existingDropdown = document.querySelector('.autocomplete-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    
                    // Set a flag to prevent autocomplete from triggering (set BEFORE any value changes)
                    token2Input.setAttribute('data-programmatic-set', 'true');
                    
                    // Set the value directly - use native setter to ensure it's properly set
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(token2Input, randomStock);
                    
                    // Also set via property for compatibility
                    token2Input.value = randomStock;
                    
                    // Verify the value was set correctly before proceeding
                    if (token2Input.value.toLowerCase() !== randomStock.toLowerCase()) {
                        token2Input.value = randomStock; // Force set again
                    }
                    
                    // Update default value styling
                    updateDefaultValueStyle(token2Input);
                    
                    // Clear display immediately to prevent showing stale data
                    const token2Logo = document.getElementById('token2-logo');
                    const token2Ticker = document.getElementById('token2-ticker-below');
                    if (token2Logo) {
                        token2Logo.style.display = 'none';
                        token2Logo.src = '';
                    }
                    if (token2Ticker) {
                        token2Ticker.style.display = 'none';
                        token2Ticker.textContent = '';
                    }
                    
                    // Small delay to ensure value is fully set before fetching display data
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Update logo and name display - WAIT for it to complete to ensure correct data
                    // Double-check the value is still correct before updating
                    const currentValue = token2Input.value.trim().toLowerCase();
                    if (currentValue === randomStock.toLowerCase()) {
                        // Store coin ID before updating display
                        token2Input.setAttribute('data-coin-id', randomStock);
                        await updateAssetDisplay(token2Input);
                        
                        // Ensure input value is locked after update with proper name mapping
                        setTimeout(() => {
                            const coinId = token2Input.getAttribute('data-coin-id');
                            if (coinId && isAssetConfirmed(token2Input)) {
                                // Extended name map including xStock tokens
                                const nameMap = {
                                    'xrp': 'Ripple',
                                    'ripple': 'Ripple',
                                    'bnb': 'BNB',
                                    'binancecoin': 'BNB',
                                    'usdt': 'Tether',
                                    'tether': 'Tether',
                                    'usdc': 'USD Coin',
                                    'usd-coin': 'USD Coin',
                                    'dai': 'Dai',
                                    'dai-stablecoin': 'Dai',
                                    'busd': 'Binance USD',
                                    'binance-usd': 'Binance USD',
                                    // xStock tokens
                                    'nvidia-xstock': 'NVIDIA xStock',
                                    'apple-xstock': 'Apple xStock',
                                    'tesla-xstock': 'Tesla xStock',
                                    'microsoft-xstock': 'Microsoft xStock',
                                    'amazon-xstock': 'Amazon xStock',
                                    'meta-xstock': 'Meta xStock',
                                    'alphabet-xstock': 'Alphabet xStock',
                                    'coinbase-xstock': 'Coinbase xStock',
                                    'netflix-xstock': 'Netflix xStock',
                                    'robinhood-xstock': 'Robinhood xStock',
                                    'spy-xstock': 'SPY xStock',
                                    'microstrategy-xstock': 'MicroStrategy xStock'
                                };
                                const mappedName = nameMap[coinId.toLowerCase()];
                                if (mappedName) {
                                    token2Input.value = mappedName;
                                    return;
                                }
                                
                                // Fallback: fetch to get ticker and name if not already set
                                fetch(`/api/coin/${encodeURIComponent(coinId)}`)
                                    .then(res => res.ok ? res.json() : null)
                                    .then(coinData => {
                                        if (coinData && coinData.name) {
                                            // If name equals symbol, use proper name mapping
                                            let displayName = coinData.name;
                                            if (coinData.symbol && coinData.name.toUpperCase() === coinData.symbol.toUpperCase()) {
                                                displayName = nameMap[coinData.id.toLowerCase()] || nameMap[coinData.symbol.toLowerCase()] || coinData.name;
                                            }
                                            token2Input.value = displayName;
                                        }
                                    })
                                    .catch(() => {}); // Ignore errors
                            }
                        }, 200);
                    }
                    
                    // Trigger change event (but NOT input event to avoid autocomplete)
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    token2Input.dispatchEvent(changeEvent);
                    
                    // Remove the flag after events are dispatched
                    setTimeout(() => {
                        token2Input.removeAttribute('data-programmatic-set');
                    }, 200);
                    
                    // Add a brief highlight animation
                    token2Input.style.animation = 'none';
                    setTimeout(() => {
                        token2Input.style.animation = 'highlightPulse 0.6s ease';
                    }, 10);
                    
                    // Focus the input
                    setTimeout(() => {
                        token2Input.focus();
                    }, 100);
                    
                    // Scroll prompt removed
                } finally {
                    // Reset lock after a delay to allow async operations to complete
                    setTimeout(() => {
                        stockDiceButtonProcessing = false;
                    }, 1000);
                }
            }, { capture: true }); // Use capture phase to ensure it fires
            
            // Setup tooltip for info icon
            const infoIcon = randomStockBtn.querySelector('.info-icon-stock');
            if (infoIcon) {
                const tooltipText = "Similar to how an investor can gain exposure to Bitcoin by holding a spot crypto ETF such as IBIT or FBTC in their brokerage account, so too can an investor gain exposure to a common stock/equity/index by holding a 'spot stock digital asset' such as NVDAx or SPYx in their digital crypto wallet.<br><br><strong>Disclaimer:</strong> xStock digital asset representations of stocks may not track 1:1 with the underlying stock price and may not contain the full price data history from before the xStock token was created.<br><br><a href='https://xstocks.fi/us' target='_blank' rel='noopener noreferrer' style='color: #22c55e; text-decoration: underline;'>Learn more about xStocks →</a>";
                
                infoIcon.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    // Remove any existing tooltips
                    document.querySelectorAll('.xstock-tooltip-popup').forEach(t => t.remove());
                    
                    // Get click position
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    
                    // Create tooltip
                    const tooltip = document.createElement('div');
                    tooltip.className = 'xstock-tooltip-popup metric-tooltip-popup';
                    tooltip.innerHTML = `
                        <div class="tooltip-header">
                            <strong>About xStocks</strong>
                            <span class="tooltip-close">×</span>
                        </div>
                        <div class="tooltip-content">${tooltipText}</div>
                    `;
                    
                    // Add to body first to get dimensions
                    tooltip.style.position = 'fixed';
                    tooltip.style.visibility = 'hidden';
                    document.body.appendChild(tooltip);
                    
                    // Get tooltip dimensions
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    // Position tooltip near click location
                    // Try to position above first, then below, then adjust horizontally
                    let top, left;
                    
                    // Check if there's space above
                    if (clickY - tooltipRect.height - 10 > 10) {
                        top = clickY - tooltipRect.height - 10;
                    } else {
                        top = clickY + 10;
                    }
                    
                    // Center horizontally on click, but keep on screen
                    left = clickX - (tooltipRect.width / 2);
                    
                    // Keep tooltip on screen horizontally
                    if (left + tooltipRect.width > viewportWidth - 10) {
                        left = viewportWidth - tooltipRect.width - 10;
                    }
                    if (left < 10) {
                        left = 10;
                    }
                    
                    // Keep tooltip on screen vertically
                    if (top + tooltipRect.height > viewportHeight - 10) {
                        top = viewportHeight - tooltipRect.height - 10;
                    }
                    if (top < 10) {
                        top = 10;
                    }
                    
                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                    tooltip.style.visibility = 'visible';
                    
                    // Close button
                    tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
                        tooltip.remove();
                    });
                    
                    // Close on outside click
                    setTimeout(() => {
                        function closeTooltip(e) {
                            if (!tooltip.contains(e.target) && !infoIcon.contains(e.target)) {
                                tooltip.remove();
                                document.removeEventListener('click', closeTooltip);
                                document.removeEventListener('scroll', closeTooltipOnScroll);
                            }
                        }
                        
                        // Close on scroll
                        function closeTooltipOnScroll() {
                            tooltip.remove();
                            document.removeEventListener('scroll', closeTooltipOnScroll);
                            document.removeEventListener('click', closeTooltip);
                        }
                        
                        document.addEventListener('click', closeTooltip);
                        document.addEventListener('scroll', closeTooltipOnScroll, { passive: true });
                    }, 100);
                });
            }
        }
    }
    
    // Function to setup xStock caution tooltip (reusable)
    function setupXStockCautionTooltip(cautionIcon) {
        const tooltipText = "<strong>⚠️ Disclaimer:</strong> xStocks are tokenized representations of stocks and indexes. These digital assets may not track 1:1 with the underlying stock price and may not contain the full price data history from before the xStock token was created. Using xStocks in this comparison tool may result in incomplete or inaccurate risk metrics compared to native cryptocurrencies.<br><br><a href='https://xstocks.fi/us' target='_blank' rel='noopener noreferrer' style='color: #22c55e; text-decoration: underline;'>Learn more about xStocks →</a>";
        
        cautionIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Remove any existing tooltips
            document.querySelectorAll('.xstock-tooltip-popup').forEach(t => t.remove());
            
            // Get click position
            const clickX = e.clientX;
            const clickY = e.clientY;
            
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'xstock-tooltip-popup metric-tooltip-popup';
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <strong>About xStocks</strong>
                    <span class="tooltip-close">×</span>
                </div>
                <div class="tooltip-content">${tooltipText}</div>
            `;
            
            // Add to body first to get dimensions
            tooltip.style.position = 'fixed';
            tooltip.style.visibility = 'hidden';
            document.body.appendChild(tooltip);
            
            // Get tooltip dimensions
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Position tooltip near click location
            let top, left;
            
            // Check if there's space above
            if (clickY - tooltipRect.height - 10 > 10) {
                top = clickY - tooltipRect.height - 10;
            } else {
                top = clickY + 10;
            }
            
            // Center horizontally on click, but keep on screen
            left = clickX - (tooltipRect.width / 2);
            
            // Keep tooltip on screen horizontally
            if (left + tooltipRect.width > viewportWidth - 10) {
                left = viewportWidth - tooltipRect.width - 10;
            }
            if (left < 10) {
                left = 10;
            }
            
            // Keep tooltip on screen vertically
            if (top + tooltipRect.height > viewportHeight - 10) {
                top = viewportHeight - tooltipRect.height - 10;
            }
            if (top < 10) {
                top = 10;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.visibility = 'visible';
            
            // Close button
            tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
                tooltip.remove();
            });
            
            // Close on outside click
            setTimeout(() => {
                document.addEventListener('click', function closeTooltip(e) {
                    if (!tooltip.contains(e.target) && !cautionIcon.contains(e.target)) {
                        tooltip.remove();
                        document.removeEventListener('click', closeTooltip);
                        document.removeEventListener('scroll', closeTooltipOnScroll);
                    }
                });
                
                // Close on scroll
                function closeTooltipOnScroll() {
                    tooltip.remove();
                    document.removeEventListener('scroll', closeTooltipOnScroll);
                    document.removeEventListener('click', closeTooltip);
                }
                document.addEventListener('scroll', closeTooltipOnScroll, { passive: true });
            }, 100);
        });
    }
    
    // Call the setup function immediately
    setupRandomStockButton();
    
    // Also retry after a delay to ensure it's set up even if DOM loads late
    setTimeout(setupRandomStockButton, 500);

    // Function to update asset display (logo, ticker, and name)
    async function updateAssetDisplay(input, coinData = null) {
        const inputId = input.id;
        const logoImg = document.getElementById(`${inputId}-logo`);
        const value = input.value.trim().toLowerCase();
        
        if (!value) {
            // Clear display
            if (logoImg) {
                logoImg.style.display = 'none';
                logoImg.src = '';
            }
            // Hide ticker below logo
            const tickerBelow = document.getElementById(`${inputId}-ticker-below`);
            if (tickerBelow) {
                tickerBelow.style.display = 'none';
                tickerBelow.textContent = '';
            }
            // Hide xStock caution icon
            const cautionIcon = document.getElementById(`${inputId}-xstock-caution`);
            if (cautionIcon) {
                cautionIcon.style.display = 'none';
            }
            // Hide chart section when input is cleared
            const chartSection = document.getElementById(`${inputId}-chart-section`);
            if (chartSection) {
                chartSection.style.display = 'none';
            }
            // Clear price and market cap display
            const priceDisplay = document.getElementById(`${inputId}-price`);
            if (priceDisplay) {
                priceDisplay.textContent = '';
                priceDisplay.style.display = 'none';
            }
            const marketCapDisplay = document.getElementById(`${inputId}-marketcap`);
            if (marketCapDisplay) {
                marketCapDisplay.textContent = '';
                marketCapDisplay.style.display = 'none';
            }
            // Clear chart
            await updateAssetChart(inputId, '');
            
            // Update analyze button glow state
            if (typeof updateAnalyzeButtonGlow === 'function') {
                setTimeout(updateAnalyzeButtonGlow, 100);
            }
            return;
        }
        
        // Helper function to update display with coin data
        const updateDisplay = async (coin) => {
            if (!coin) return;
            
            if (logoImg && coin.thumb) {
                logoImg.src = coin.thumb;
                logoImg.alt = coin.name || value;
                logoImg.style.display = 'block';
                logoImg.onerror = () => {
                    logoImg.style.display = 'none';
                };
            }
            
            // Show ticker below logo when asset is confirmed
            const tickerBelow = document.getElementById(`${inputId}-ticker-below`);
            if (tickerBelow && coin.symbol) {
                tickerBelow.textContent = coin.symbol.toUpperCase();
                tickerBelow.style.display = 'block';
            }
            
            // Check if this is an xStock and show caution icon
            const isXStock = coin.id && coin.id.toLowerCase().includes('xstock');
            const cautionIcon = document.getElementById(`${inputId}-xstock-caution`);
            if (cautionIcon) {
                if (isXStock) {
                    cautionIcon.style.display = 'flex';
                    // Setup tooltip for caution icon if not already set up
                    if (!cautionIcon.hasAttribute('data-tooltip-setup')) {
                        cautionIcon.setAttribute('data-tooltip-setup', 'true');
                        setupXStockCautionTooltip(cautionIcon);
                    }
                } else {
                    cautionIcon.style.display = 'none';
                }
            }
            
            // Update input value to show only the asset name when asset is confirmed
            if (coin.symbol && coin.name) {
                // Store the coin ID in a data attribute for form submission
                input.setAttribute('data-coin-id', coin.id);
                // Update the input value to show only the name (ticker is shown below icon)
                // If name equals symbol (uppercase), use a proper name mapping
                let displayName = coin.name;
                if (coin.name.toUpperCase() === coin.symbol.toUpperCase()) {
                    // Map common coins where name equals symbol
                    const nameMap = {
                        'xrp': 'Ripple',
                        'ripple': 'Ripple',
                        'bnb': 'Binance Coin',
                        'binancecoin': 'Binance Coin',
                        'usdt': 'Tether',
                        'tether': 'Tether',
                        'usdc': 'USD Coin',
                        'usd-coin': 'USD Coin',
                        'dai': 'Dai',
                        'dai-stablecoin': 'Dai',
                        'busd': 'Binance USD',
                        'binance-usd': 'Binance USD'
                    };
                    displayName = nameMap[coin.id.toLowerCase()] || nameMap[coin.symbol.toLowerCase()] || coin.name;
                }
                input.value = displayName;
                
                // Force the value to stay locked by setting it again after a brief delay
                // This prevents any event handlers from reverting it
                setTimeout(() => {
                    const currentCoinId = input.getAttribute('data-coin-id');
                    if (currentCoinId === coin.id && isAssetConfirmed(input)) {
                        const nameMap = {
                            'xrp': 'Ripple',
                            'ripple': 'Ripple',
                            'bnb': 'Binance Coin',
                            'binancecoin': 'Binance Coin',
                            'usdt': 'Tether',
                            'tether': 'Tether',
                            'usdc': 'USD Coin',
                            'usd-coin': 'USD Coin',
                            'dai': 'Dai',
                            'dai-stablecoin': 'Dai',
                            'busd': 'Binance USD',
                            'binance-usd': 'Binance USD'
                        };
                        const mappedName = nameMap[currentCoinId.toLowerCase()];
                        // Only fix if the current value is wrong (ticker, coin ID, or lowercase version)
                        const currentValue = input.value.trim();
                        const isWrong = mappedName && (
                            currentValue.toUpperCase() === currentCoinId.toUpperCase() ||
                            currentValue === 'XRP' || currentValue === 'xrp' ||
                            currentValue === 'BNB' || currentValue === 'bnb' ||
                            currentValue === 'ripple' || currentValue === 'binancecoin'
                        );
                        if (isWrong && input.value !== mappedName) {
                            input.value = mappedName;
                        }
                    }
                }, 200);
            }
            
            // Show chart section when asset is selected
            const chartSection = document.getElementById(`${inputId}-chart-section`);
            if (chartSection && (coin.symbol || coin.name)) {
                chartSection.style.display = 'flex';
            }
            
            // Update chart with coin ID
            if (coin.id) {
                await updateAssetChart(inputId, coin.id);
            }
            
            // Update analyze button glow state
            if (typeof updateAnalyzeButtonGlow === 'function') {
                setTimeout(updateAnalyzeButtonGlow, 100);
            }
        };
        
        // If coinData is provided (from autocomplete), use it
        if (coinData && coinData.thumb) {
            await updateDisplay(coinData);
            return;
        }
        
        // Otherwise, try to fetch coin data
        // First try direct coin lookup by ID (most reliable), then fallback to search
        try {
            // Try direct coin lookup by ID first (most accurate)
            try {
                const coinResponse = await fetch(`/api/coin/${encodeURIComponent(value)}`);
                if (coinResponse.ok) {
                    const coinData = await coinResponse.json();
                    if (coinData && coinData.id && coinData.id.toLowerCase() === value.toLowerCase()) {
                        // Verify it's the correct coin before using it
                        await updateDisplay(coinData);
                        return; // Success, exit early
                    } else if (coinResponse.status === 404) {
                        // Coin not found, fall through to search
                    }
                } else if (coinResponse.status === 404) {
                    // Coin not found, fall through to search
                }
            } catch (directError) {
                // If direct lookup fails, fall through to search
            }
            
            // Fallback: try search API to find exact match
            const response = await fetch(`/api/search-tokens?query=${encodeURIComponent(value)}`);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Find exact match by ID (case-insensitive) - this is critical
                const exactMatch = data.results.find(coin => coin.id.toLowerCase() === value.toLowerCase());
                
                if (exactMatch) {
                    // Only use exact match - don't use partial matches
                    await updateDisplay(exactMatch);
                } else {
                    // No exact match found - try to find by symbol (exact symbol match only)
                    const symbolMatch = data.results.find(coin => 
                        coin.symbol.toLowerCase() === value.toLowerCase()
                    );
                    
                    if (symbolMatch) {
                        await updateDisplay(symbolMatch);
                    } else {
                        // If no exact match at all, don't show wrong coin - just log and return
                        // Don't update display with wrong coin
                    }
                }
            }
        } catch (error) {
        }
    }
    
    // Initialize asset displays for default values
        document.querySelectorAll('.token-input').forEach(input => {
            if (input.value) {
                // For default values (bitcoin, ethereum), store the coin ID
                const value = input.value.trim().toLowerCase();
                if (value === 'bitcoin' || value === 'ethereum') {
                    input.setAttribute('data-coin-id', value);
                }
                updateAssetDisplay(input).catch(() => {});
            }
            
            // Store previous value when clearing (using closure per input)
            let previousValue = '';
            
            // Helper function to check if asset is confirmed (logo is visible)
            const isAssetConfirmed = (inputElement) => {
                const inputId = inputElement.id;
                const logoImg = document.getElementById(`${inputId}-logo`);
                return logoImg && logoImg.style.display !== 'none' && logoImg.src;
            };
            
            // Click/touch handler: clear input on single click/touch to allow fresh typing
            // Always clear on click, even if asset is confirmed - user explicitly wants to edit
            const handleInputClear = (e) => {
                const value = e.target.value.trim();
                
                // Only clear if there's a value and user clicked (not selecting text)
                // Check if there's a text selection - if so, don't clear
                const selectionStart = e.target.selectionStart;
                const selectionEnd = e.target.selectionEnd;
                const hasSelection = selectionStart !== selectionEnd;
                
                if (value && !hasSelection) {
                    // Store previous value for potential restoration
                    previousValue = value;
                    
                    // Set flag to prevent autocomplete from triggering with old value
                    e.target.setAttribute('data-clearing', 'true');
                    
                    // Clear the input immediately
                    e.target.value = '';
                    
                    // Clear any existing autocomplete dropdown
                    const existingDropdown = document.querySelector('.autocomplete-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    
                    // Remove the flag after a brief delay to allow fresh typing
                    setTimeout(() => {
                        e.target.removeAttribute('data-clearing');
                    }, 100);
                    
                    // Don't remove data-coin-id - keep it for analyze button
                }
            };
            
            // Use mousedown instead of click to fire before focus event
            // Also use capture phase to ensure it runs first
            input.addEventListener('mousedown', handleInputClear, { capture: true });
            input.addEventListener('touchstart', handleInputClear, { passive: true, capture: true });
            
            // Clear input on focus if asset is not confirmed
            // BUT only if asset is not confirmed (logo not showing)
            input.addEventListener('focus', (e) => {
                const value = e.target.value.trim();
                // Don't clear if asset is confirmed (logo is showing)
                if (isAssetConfirmed(e.target)) {
                    return; // Keep the value locked when asset is confirmed
                }
                
                // Only clear on focus if it wasn't already cleared by click/touch
                // Check if we just cleared it (data-clearing flag)
                if (e.target.getAttribute('data-clearing') === 'true') {
                    return; // Already cleared by click/touch handler
                }
                
                // Store previous value for potential restoration
                if (value) {
                    previousValue = value;
                    
                    // Set flag to prevent autocomplete from triggering with old value
                    e.target.setAttribute('data-clearing', 'true');
                    
                    e.target.value = '';
                    
                    // Clear any existing autocomplete dropdown
                    const existingDropdown = document.querySelector('.autocomplete-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                    }
                    
                    // Remove the flag after a brief delay
                    setTimeout(() => {
                        e.target.removeAttribute('data-clearing');
                    }, 100);
                    
                    // Don't remove data-coin-id - keep it for analyze button
                }
            });
            
            // Restore previous value on blur if input is empty and coin ID exists
            // OR if asset is confirmed, always restore the ticker and name
            input.addEventListener('blur', async (e) => {
                const value = e.target.value.trim();
                const coinId = e.target.getAttribute('data-coin-id');
                
                // If asset is confirmed (logo showing), always restore ticker and name
                if (isAssetConfirmed(e.target) && coinId) {
                    // First try direct name mapping based on coinId
                    const nameMap = {
                        'xrp': 'Ripple',
                        'ripple': 'Ripple',
                        'bnb': 'Binance Coin',
                        'binancecoin': 'Binance Coin',
                        'usdt': 'Tether',
                        'tether': 'Tether',
                        'usdc': 'USD Coin',
                        'usd-coin': 'USD Coin',
                        'dai': 'Dai',
                        'dai-stablecoin': 'Dai',
                        'busd': 'Binance USD',
                        'binance-usd': 'Binance USD'
                    };
                    const mappedName = nameMap[coinId.toLowerCase()];
                    if (mappedName) {
                        e.target.value = mappedName;
                        previousValue = ''; // Clear stored value
                        return;
                    }
                    
                    // Fallback: fetch coin data to get name
                    try {
                        const coinResponse = await fetch(`/api/coin/${encodeURIComponent(coinId)}`);
                        if (coinResponse.ok) {
                            const coinData = await coinResponse.json();
                            if (coinData && coinData.name) {
                                // If name equals symbol, use proper name mapping
                                let displayName = coinData.name;
                                if (coinData.symbol && coinData.name.toUpperCase() === coinData.symbol.toUpperCase()) {
                                    displayName = nameMap[coinData.id.toLowerCase()] || nameMap[coinData.symbol.toLowerCase()] || coinData.name;
                                }
                                e.target.value = displayName;
                                previousValue = ''; // Clear stored value
                                return;
                            }
                        }
                    } catch (error) {
                        // If fetch fails, try to restore from previousValue
                    }
                    
                    // Fallback: restore from previousValue if available
                    if (previousValue) {
                        e.target.value = previousValue;
                        previousValue = ''; // Clear stored value
                        return;
                    }
                }
                
                // If input is empty but we have a coin ID, restore the previous value
                if (!value && coinId && previousValue) {
                    e.target.value = previousValue;
                    previousValue = ''; // Clear stored value
                } else if (!value && !coinId) {
                    // If no value and no coin ID, clear everything
                    previousValue = '';
                }
            });
            
            // Clear entire field on first backspace if asset is confirmed
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.selectionStart && !e.target.selectionEnd) {
                    const value = e.target.value.trim();
                    // If asset is confirmed, prevent clearing
                    if (isAssetConfirmed(e.target)) {
                        e.preventDefault();
                        return; // Keep the value locked
                    }
                    if (value) {
                        e.preventDefault();
                        previousValue = value; // Store for potential restoration
                        e.target.value = '';
                        // Don't remove data-coin-id - keep it for analyze button
                        // Don't clear logo and chart - they should persist
                    }
                }
            });
            
            // Update on change
            input.addEventListener('change', () => {
                updateAssetDisplay(input).catch(() => {});
            });
        });

    // Setup autocomplete and clear buttons for existing inputs (including first input)
    document.querySelectorAll('.token-input-group').forEach(group => {
        const input = group.querySelector('.token-input');
        const clearBtn = group.querySelector('.btn-remove-token');
        
        // Setup autocomplete
        if (input) {
            setupAutocomplete(input);
            
            // Add focus, blur, and backspace handlers (if not already added)
            if (!input.hasAttribute('data-focus-handler-added')) {
                input.setAttribute('data-focus-handler-added', 'true');
                
                // Store previous value when clearing (using closure per input)
                let previousValue = '';
                
                // Helper function to check if asset is confirmed (logo is visible)
                const isAssetConfirmed = (inputElement) => {
                    const inputId = inputElement.id;
                    const logoImg = document.getElementById(`${inputId}-logo`);
                    return logoImg && logoImg.style.display !== 'none' && logoImg.src;
                };
                
                input.addEventListener('focus', (e) => {
                    const value = e.target.value.trim();
                    // Don't clear if asset is confirmed (logo is showing)
                    if (isAssetConfirmed(e.target)) {
                        return; // Keep the value locked when asset is confirmed
                    }
                    // Store previous value for potential restoration
                    if (value) {
                        previousValue = value;
                        e.target.value = '';
                        // Don't remove data-coin-id - keep it for analyze button
                    }
                });
                
                // Restore previous value on blur if input is empty and coin ID exists
                // OR if asset is confirmed, always restore just the name
                input.addEventListener('blur', async (e) => {
                    const value = e.target.value.trim();
                    const coinId = e.target.getAttribute('data-coin-id');
                    
                    // If asset is confirmed (logo showing), always restore just the name
                    if (isAssetConfirmed(e.target) && coinId) {
                        // Fetch coin data to get name
                        try {
                            const coinResponse = await fetch(`/api/coin/${encodeURIComponent(coinId)}`);
                            if (coinResponse.ok) {
                                const coinData = await coinResponse.json();
                                if (coinData && coinData.name) {
                                    e.target.value = coinData.name;
                                    previousValue = ''; // Clear stored value
                                    return;
                                }
                            }
                        } catch (error) {
                            // If fetch fails, try to restore from previousValue
                        }
                        
                        // Fallback: restore from previousValue if available
                        if (previousValue) {
                            e.target.value = previousValue;
                            previousValue = ''; // Clear stored value
                            return;
                        }
                    }
                    
                    // If input is empty but we have a coin ID, restore the previous value
                    if (!value && coinId && previousValue) {
                        e.target.value = previousValue;
                        previousValue = ''; // Clear stored value
                    } else if (!value && !coinId) {
                        // If no value and no coin ID, clear everything
                        previousValue = '';
                    }
                });
                
                // Add backspace handler to clear entire field
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.selectionStart && !e.target.selectionEnd) {
                        const value = e.target.value.trim();
                        // If asset is confirmed, prevent clearing
                        if (isAssetConfirmed(e.target)) {
                            e.preventDefault();
                            return; // Keep the value locked
                        }
                        if (value) {
                            e.preventDefault();
                            previousValue = value; // Store for potential restoration
                            e.target.value = '';
                            // Don't remove data-coin-id - keep it for analyze button
                            // Don't clear logo and chart - they should persist
                        }
                    }
                });
            }
        }
        
        // Setup clear button for first input (and any others that might not have it)
        if (clearBtn && input) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = '';
                input.removeAttribute('data-coin-id'); // Clear stored coin ID
                updateAssetDisplay(input).catch(() => {}); // Clear logo and name
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

        // Scroll prompt removed

        // Add exciting click feedback animation
        analyzeBtn.style.animation = 'analyzeClick 0.6s ease';
        analyzeBtn.style.transform = 'scale(1.05)';
        
        // Reset animation after it completes
        setTimeout(() => {
            analyzeBtn.style.animation = 'gentleSwell 3s ease-in-out infinite';
            analyzeBtn.style.transform = '';
        }, 600);
        
        // Validate tokens before analysis
        const btnLoading = document.getElementById('btnLoading');
        const loadingDetails = document.getElementById('loadingDetails');
        
        // Small delay before showing loading state for better UX
        setTimeout(() => {
            analyzeBtn.classList.add('hidden');
            analyzeBtn.style.display = 'none';
            btnLoading.classList.remove('hidden');
            btnLoading.style.display = '';
            loadingDetails.textContent = 'Validating digital assets...';
        }, 300);

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
        const winnerId = winner.id.toLowerCase();
        winnerDiv.innerHTML = `
            <div class="winner-header">🏆 <strong>${winnerName}</strong> shows the best overall risk-adjusted performance over the past ${timeframeText}${comparisonText}</div>
            <div class="winner-price-range">
                <div class="price-range-line-current">
                    <span class="price-label">Current Price:</span>
                    <span class="price-value-large">$${winnerCurrent}</span>
                </div>
                <div class="price-range-line-1">
                    <span class="price-label">${winnerRangeLabel}</span>
                    <span class="info-icon" data-metric="priceRange" data-timeframe="${timeframeText}">ⓘ</span>
                </div>
                <div class="price-range-line-2">
                    <span class="price-value">$${winnerHigh} - $${winnerLow}</span>
                </div>
            </div>
            <div class="asset-chart-section winner-chart-section" id="winner-${winnerId}-chart-section">
                <div class="asset-chart-container">
                    <div class="chart-labels" id="winner-${winnerId}-chart-labels"></div>
                    <canvas id="winner-${winnerId}-chart" class="asset-chart"></canvas>
                </div>
                <div class="asset-price-wrapper">
                    <span class="asset-price-label">Current Price</span>
                    <span class="asset-price-chart" id="winner-${winnerId}-price">$${winnerCurrent}</span>
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
        
        // Render chart for winner
        setTimeout(async () => {
            await updateAssetChart(`winner-${winnerId}`, winner.id);
        }, 100);

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
        summaryDiv.id = 'quickOverviewSection';
        
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
            const currentPrice = formatPriceDisplay(tokenData.currentPrice);
            
            const performanceClass = tokenData.sharpeRatio > 1 ? 'excellent' : tokenData.sharpeRatio > 0 ? 'good' : 'poor';
            
            // Determine range label based on timeframe
            let rangeLabel = timeframeText === '1 year' ? '52-Week High/Low' : `${timeframeText} Range`;
            
            // Determine return label based on timeframe
            let returnLabel = timeframeText === '1 year' ? '1 Year Return' : `${timeframeText} Return`;
            
            summaryHTML += `
                <div class="summary-card ${performanceClass} clickable" data-token="${tokenId}" role="button" tabindex="0" aria-label="View detailed analysis for ${tokenName}">
                    <h4>${tokenName}</h4>
                    <div class="current-price-summary">
                        <span class="price-label">Current Price:</span>
                        <span class="price-value">$${currentPrice}</span>
                    </div>
                    <div class="asset-chart-section summary-chart-section" id="summary-${tokenId}-chart-section">
                        <div class="asset-chart-container">
                            <div class="chart-labels" id="summary-${tokenId}-chart-labels"></div>
                            <canvas id="summary-${tokenId}-chart" class="asset-chart"></canvas>
                        </div>
                        <div class="asset-price-wrapper">
                            <span class="asset-price-label">Current Price</span>
                            <span class="asset-price-chart" id="summary-${tokenId}-price">$${currentPrice}</span>
                        </div>
                    </div>
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
        
        // Render charts for all summary cards
        setTimeout(async () => {
            tokenResults.forEach(async (tokenData) => {
                const tokenId = tokenData.id.toLowerCase();
                await updateAssetChart(`summary-${tokenId}`, tokenData.id);
            });
        }, 200);
        
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
                        
                        // Show floating scroll-up button
                        showScrollUpButton();
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
            try {
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
                    </div>
                `;

                interpretationsSection.appendChild(assetCard);

                // Add interpretations to the content area
                const contentArea = assetCard.querySelector(`#assetContent${index}`);
                
                if (!contentArea) {
                    return;
                }
                
                // Return metrics interpretation
                try {
                    contentArea.appendChild(getReturnMetricsInterpretation(
                        tokenData.periodReturn,
                        tokenData.cagr,
                        tokenData.annualizedReturn,
                        tokenName,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Volatility interpretation
                try {
                    contentArea.appendChild(getVolatilityInterpretation(
                        tokenData.volatility,
                        tokenName,
                        volatilityPct,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Sharpe interpretation
                try {
                    contentArea.appendChild(getSharpeInterpretation(
                        tokenData.sharpeRatio,
                        tokenName,
                        annualizedReturnPct,
                        volatilityPct,
                        data.riskFreeRate,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Maximum Drawdown interpretation
                try {
                    contentArea.appendChild(getMaxDrawdownInterpretation(
                        tokenData.maxDrawdown,
                        tokenName,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Sortino interpretation
                try {
                    contentArea.appendChild(getSortinoInterpretation(
                        tokenData.sortinoRatio,
                        tokenName,
                        annualizedReturnPct,
                        downsideVolPct,
                        data.riskFreeRate,
                        tokenData.sharpeRatio,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Calmar interpretation
                try {
                    contentArea.appendChild(getCalmarInterpretation(
                        tokenData.calmarRatio,
                        tokenName,
                        tokenData.annualizedReturn,
                        tokenData.maxDrawdown,
                        timeframeText
                    ));
                } catch (e) {
                }
                
                // Beta interpretation (if data available)
                try {
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
                } catch (e) {
                }
                
                // Correlation interpretation (if data available)
                try {
                    if ((tokenData.correlationToSP500 !== null && tokenData.correlationToSP500 !== undefined) || 
                        (tokenData.correlationToBitcoin !== null && tokenData.correlationToBitcoin !== undefined)) {
                        contentArea.appendChild(getCorrelationInterpretation(
                            tokenData.correlationToSP500,
                            tokenData.correlationToBitcoin,
                            tokenName,
                            timeframeText
                        ));
                    }
                } catch (e) {
                }
                
                // Add click handler for expand/collapse
                const headerBtn = assetCard.querySelector('.expand-asset-btn');
                if (headerBtn) {
                    headerBtn.addEventListener('click', () => {
                        contentArea.classList.toggle('collapsed');
                        const isCollapsed = contentArea.classList.contains('collapsed');
                        const expandText = headerBtn.querySelector('.expand-text');
                        const expandIcon = headerBtn.querySelector('.expand-icon');
                        if (expandText) expandText.textContent = isCollapsed ? 'Expand Analysis' : 'Collapse Analysis';
                        if (expandIcon) expandIcon.textContent = isCollapsed ? '▼' : '▲';
                    });
                }
            } catch (error) {
                // Continue processing other assets even if one fails
            }
        });

        detailedContent.appendChild(interpretationsSection);

        // Add toggle functionality for detailed section
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

    // Ensure analyze button is visible on first load
    function ensureAnalyzeButtonVisible() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            // Use requestAnimationFrame to check after layout
            requestAnimationFrame(() => {
                const rect = analyzeBtn.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const isVisible = rect.top >= 0 && rect.top <= viewportHeight;
                
                if (!isVisible) {
                    // Scroll to button if not visible, but only slightly
                    setTimeout(() => {
                        analyzeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 300);
                }
            });
        }
    }
    
    // Check on load and after a short delay
    window.addEventListener('load', ensureAnalyzeButtonVisible);
    setTimeout(ensureAnalyzeButtonVisible, 500);
    
    // Scroll prompt functionality removed
    
    // Function to check if all 3 assets are confirmed
    function areAllAssetsConfirmed() {
        const token0Input = document.getElementById('token0');
        const token1Input = document.getElementById('token1');
        const token2Input = document.getElementById('token2');
        
        const isAssetConfirmed = (inputElement) => {
            if (!inputElement) return false;
            const inputId = inputElement.id;
            const logoImg = document.getElementById(`${inputId}-logo`);
            return logoImg && logoImg.style.display !== 'none' && logoImg.src;
        };
        
        return isAssetConfirmed(token0Input) && 
               isAssetConfirmed(token1Input) && 
               isAssetConfirmed(token2Input);
    }
    
    // Function to update analyze button glow state
    function updateAnalyzeButtonGlow() {
        if (!analyzeBtn) return;
        
        if (areAllAssetsConfirmed()) {
            // Check if button is in view
            const rect = analyzeBtn.getBoundingClientRect();
            const isInView = rect.top >= 0 && rect.top <= window.innerHeight;
            
            if (isInView) {
                analyzeBtn.classList.add('in-view');
            } else {
                analyzeBtn.classList.remove('in-view');
            }
        } else {
            analyzeBtn.classList.remove('in-view');
        }
    }
    
    // Make analyze button glow when it's in view AND all assets are confirmed
    if (analyzeBtn) {
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -20% 0px', // Trigger when button is in center 60% of viewport
            threshold: 0.5
        };
        
        const analyzeButtonObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && areAllAssetsConfirmed()) {
                    analyzeBtn.classList.add('in-view');
                } else {
                    analyzeBtn.classList.remove('in-view');
                }
            });
        }, observerOptions);
        
        analyzeButtonObserver.observe(analyzeBtn);
        
        // Also check when assets are updated
        const checkAssets = () => updateAnalyzeButtonGlow();
        document.getElementById('token0')?.addEventListener('input', checkAssets);
        document.getElementById('token1')?.addEventListener('input', checkAssets);
        document.getElementById('token2')?.addEventListener('input', checkAssets);
        
        // Initial check
        setTimeout(updateAnalyzeButtonGlow, 500);
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

    // Floating scroll-up button functionality
    let scrollUpButton = null;
    
    function showScrollUpButton() {
        // Remove existing button if present
        if (scrollUpButton) {
            scrollUpButton.remove();
        }
        
        // Create floating scroll-up button
        scrollUpButton = document.createElement('button');
        scrollUpButton.className = 'scroll-up-button';
        scrollUpButton.innerHTML = '↑<br><span>Back to<br>Overview</span>';
        scrollUpButton.setAttribute('aria-label', 'Scroll back to Quick Overview');
        
        // Add click handler
        scrollUpButton.addEventListener('click', () => {
            const quickOverview = document.getElementById('quickOverviewSection');
            if (quickOverview) {
                quickOverview.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Hide button after scrolling
            setTimeout(() => {
                if (scrollUpButton) {
                    scrollUpButton.classList.add('fade-out');
                    setTimeout(() => {
                        if (scrollUpButton) {
                            scrollUpButton.remove();
                            scrollUpButton = null;
                        }
                    }, 300);
                }
            }, 500);
        });
        
        // Add to body
        document.body.appendChild(scrollUpButton);
        
        // Fade in animation
        setTimeout(() => {
            if (scrollUpButton) {
                scrollUpButton.classList.add('visible');
            }
        }, 100);
    }
    
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
