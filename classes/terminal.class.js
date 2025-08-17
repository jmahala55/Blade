// Mock terminal class for visual-only eDEX-UI
class Terminal {
    constructor(config) {
        this.config = config;
        this.port = config.port || 3000;
        
        // Mock the expected properties and methods
        this.onclosed = () => {};
        this.onopened = () => {};
        this.onresized = () => {};
        this.ondisconnected = () => {};
        
        // Simulate successful connection
        setTimeout(() => {
            if (this.onopened) this.onopened();
        }, 100);
    }
    
    close() {
        // Mock close
    }
}

module.exports = { Terminal };
