const { pathToFileURL } = require("url");


class Netstat {
    constructor(container) {
        this.container = container;
        this.iface = 'auto';
        this.geoReader = null;
        
        // Initialize geolocation reader with fallback
        this.initGeoReader();
        
        // Continue with rest of initialization...
        this.createDOM();
        this.updateInfo();
        
        // Update interval
        this.updateInterval = setInterval(() => {
            this.updateInfo();
        }, 1000);
    }
    
    async initGeoReader() {
        try {
          // Import geolite2-redist (ESM) via Node resolution -> file:// URL
          const geoliteHref = pathToFileURL(require.resolve("geolite2-redist")).href;
          const geoliteMod = await import(geoliteHref);
          const geolite2 = geoliteMod.default || geoliteMod; // supports default/named export
      
          // Load maxmind (try CJS require first; fall back to ESM import if needed)
          let maxmind;
          try {
            maxmind = require("maxmind");
          } catch {
            const mmHref = pathToFileURL(require.resolve("maxmind")).href;
            const mmMod = await import(mmHref);
            maxmind = mmMod.default || mmMod;
          }
      
          // Open the city database
          this.geoReader = await maxmind.open(geolite2.paths.city);
        } catch (e) {
          console.warn("GeoIP functionality not available:", e);
          this.geoReader = null;
        }
      }
      
    
    getLocationFromIP(ip) {
        if (!this.geoReader) {
            return {
                country: 'Unknown',
                city: 'Unknown',
                latitude: 0,
                longitude: 0
            };
        }
        
        try {
            const result = this.geoReader.get(ip);
            return {
                country: result?.country?.names?.en || 'Unknown',
                city: result?.city?.names?.en || 'Unknown',
                latitude: result?.location?.latitude || 0,
                longitude: result?.location?.longitude || 0
            };
        } catch (e) {
            console.warn("Error getting location for IP:", ip, e);
            return {
                country: 'Unknown',
                city: 'Unknown',
                latitude: 0,
                longitude: 0
            };
        }
    }
    
    createDOM() {
        // Create the netstat display DOM
        this.containerElement = document.getElementById(this.container);
        if (!this.containerElement) {
            console.error("Container not found:", this.container);
            return;
        }
        
        const netstatDiv = document.createElement('div');
        netstatDiv.id = 'mod_netstat';
        netstatDiv.innerHTML = `
            <div id="mod_netstat_inner">
                <h1>Network Status <i>AUTO</i></h1>
                <div id="mod_netstat_innercontainer">
                    <div>
                        <h1>Status</h1>
                        <h2 id="netstat_status">Checking...</h2>
                    </div>
                    <div>
                        <h1>Interface</h1>
                        <h2 id="netstat_interface">-</h2>
                    </div>
                    <div>
                        <h1>IP Address</h1>
                        <h2 id="netstat_ip">-</h2>
                    </div>
                    <div>
                        <h1>Ping</h1>
                        <h2 id="netstat_ping">-</h2>
                    </div>
                </div>
            </div>
        `;
        
        this.containerElement.appendChild(netstatDiv);
    }
    
    async updateInfo() {
        try {
            // Get network interfaces
            const interfaces = await window.si.networkInterfaces();
            const defaultInterface = interfaces.find(iface => iface.default) || interfaces[0];
            
            if (defaultInterface) {
                this.iface = defaultInterface.iface;
                document.getElementById('netstat_interface').textContent = this.iface;
                document.getElementById('netstat_ip').textContent = defaultInterface.ip4 || 'N/A';
                document.getElementById('netstat_status').textContent = defaultInterface.operstate || 'Unknown';
            }
            
            // Test ping
            try {
                const ping = await window.si.inetLatency();
                document.getElementById('netstat_ping').textContent = ping ? `${ping}ms` : 'N/A';
            } catch (e) {
                document.getElementById('netstat_ping').textContent = 'N/A';
            }
            
        } catch (error) {
            console.error("Error updating network info:", error);
            document.getElementById('netstat_status').textContent = 'Error';
        }
    }
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.geoReader) {
            this.geoReader = null;
        }
    }
}