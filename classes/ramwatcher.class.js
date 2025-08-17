class RAMwatcher {
    constructor(container) {
        this.container = container;
        this.memoryHistory = [];
        this.maxHistoryPoints = 440; // 11 rows * 40 columns
        
        this.createDOM();
        
        // Start monitoring with error handling
        this.updateInterval = setInterval(() => {
            this.updateInfo().catch(error => {
                console.warn("RAM Watcher update failed:", error.message);
                // Continue running even if update fails
            });
        }, 1000);
        
        // Initial update
        this.updateInfo().catch(error => {
            console.warn("Initial RAM Watcher update failed:", error.message);
        });
    }
    
    createDOM() {
        this.containerElement = document.getElementById(this.container);
        if (!this.containerElement) {
            console.error("Container not found:", this.container);
            return;
        }
        
        const ramDiv = document.createElement('div');
        ramDiv.id = 'mod_ramwatcher';
        ramDiv.innerHTML = `
            <div id="mod_ramwatcher_inner">
                <h1>Memory Monitor <i>SYSTEM RAM</i></h1>
                <div id="mod_ramwatcher_pointmap"></div>
                <div id="mod_ramwatcher_swapcontainer">
                    <h1>SWAP</h1>
                    <progress id="mod_ramwatcher_swapbar" value="0" max="100"></progress>
                    <h3 id="mod_ramwatcher_swaptext">0%</h3>
                </div>
            </div>
        `;
        
        this.containerElement.appendChild(ramDiv);
        
        // Create memory visualization grid
        this.createMemoryGrid();
    }
    
    createMemoryGrid() {
        const pointMap = document.getElementById('mod_ramwatcher_pointmap');
        if (!pointMap) return;
        
        // Create 440 points (11 rows x 40 columns)
        for (let i = 0; i < this.maxHistoryPoints; i++) {
            const point = document.createElement('div');
            point.className = 'mod_ramwatcher_point free';
            pointMap.appendChild(point);
        }
    }
    
    async updateInfo() {
        try {
            // Get memory information
            const memInfo = await window.si.mem();
            
            // Validate memory data
            if (!memInfo || typeof memInfo.total !== 'number' || memInfo.total <= 0) {
                throw new Error("Invalid memory data received");
            }
            
            // Calculate memory usage percentages
            const totalMem = memInfo.total;
            const usedMem = memInfo.used || 0;
            const freeMem = memInfo.free || 0;
            const availableMem = memInfo.available || freeMem;
            
            // Ensure values are valid
            if (totalMem <= 0) {
                throw new Error("Total memory is zero or negative");
            }
            
            const usedPercent = Math.min(100, Math.max(0, (usedMem / totalMem) * 100));
            const freePercent = Math.min(100, Math.max(0, (freeMem / totalMem) * 100));
            const availablePercent = Math.min(100, Math.max(0, (availableMem / totalMem) * 100));
            
            // Add to history
            this.memoryHistory.push({
                used: usedPercent,
                free: freePercent,
                available: availablePercent
            });
            
            // Limit history size
            if (this.memoryHistory.length > this.maxHistoryPoints) {
                this.memoryHistory.shift();
            }
            
            // Update visualization
            this.updateVisualization();
            
            // Update swap information
            await this.updateSwapInfo();
            
        } catch (error) {
            console.error("RAM Watcher Error:", error.message);
            
            // Create dummy data to prevent crashes
            this.memoryHistory.push({
                used: 0,
                free: 100,
                available: 100
            });
            
            if (this.memoryHistory.length > this.maxHistoryPoints) {
                this.memoryHistory.shift();
            }
            
            this.updateVisualization();
        }
    }
    
    updateVisualization() {
        const points = document.querySelectorAll('.mod_ramwatcher_point');
        
        // Clear all points first
        points.forEach(point => {
            point.className = 'mod_ramwatcher_point free';
        });
        
        // Update points based on history
        this.memoryHistory.forEach((memData, historyIndex) => {
            if (historyIndex < points.length) {
                const point = points[historyIndex];
                
                if (memData.used > 80) {
                    point.className = 'mod_ramwatcher_point active';
                } else if (memData.used > 50) {
                    point.className = 'mod_ramwatcher_point available';
                } else {
                    point.className = 'mod_ramwatcher_point free';
                }
            }
        });
    }
    
    async updateSwapInfo() {
        try {
            const memInfo = await window.si.mem();
            const swapTotal = memInfo.swaptotal || 0;
            const swapUsed = memInfo.swapused || 0;
            
            if (swapTotal > 0) {
                const swapPercent = (swapUsed / swapTotal) * 100;
                document.getElementById('mod_ramwatcher_swapbar').value = swapPercent;
                document.getElementById('mod_ramwatcher_swaptext').textContent = `${Math.round(swapPercent)}%`;
            } else {
                document.getElementById('mod_ramwatcher_swapbar').value = 0;
                document.getElementById('mod_ramwatcher_swaptext').textContent = 'N/A';
            }
        } catch (error) {
            console.warn("Could not update swap info:", error);
            document.getElementById('mod_ramwatcher_swapbar').value = 0;
            document.getElementById('mod_ramwatcher_swaptext').textContent = 'N/A';
        }
    }
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.memoryHistory = [];
    }
}