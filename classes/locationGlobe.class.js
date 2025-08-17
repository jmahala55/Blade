class LocationGlobe {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        const path = require("path");

        this._geodata = require(path.join(__dirname, "assets/misc/grid.json"));

        // Attempt to load encom-globe.js with fallback
        let encomModule;
        try {
            // Try loading as a module first
            encomModule = require(path.join(__dirname, "assets/vendor/encom-globe.js"));
            if (encomModule && encomModule.ENCOM && encomModule.ENCOM.Globe) {
                this.ENCOM = encomModule.ENCOM;
            } else if (window.ENCOM && window.ENCOM.Globe) {
                this.ENCOM = window.ENCOM;
            } else {
                throw new Error("ENCOM.Globe not found in module or window");
            }
            console.log("Encom Globe loaded");
        } catch (e) {
            console.warn("Failed to load Encom Globe:", e.message);
            this.ENCOM = null;
            return; // Exit early if loading fails
        }

        // Create DOM and include lib
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_globe">
            <div id="mod_globe_innercontainer">
                <h1>WORLD VIEW<i>GLOBAL NETWORK MAP</i></h1>
                <h2>ENDPOINT LAT/LON<i class="mod_globe_headerInfo">0.0000, 0.0000</i></h2>
                <div id="mod_globe_canvas_placeholder"></div>
                <h3>OFFLINE</h3>
            </div>
        </div>`;

        this.lastgeo = {};
        this.conns = [];

        setTimeout(() => {
            if (!this.ENCOM || !this.ENCOM.Globe) {
                console.warn("Globe not initialized due to missing ENCOM.Globe constructor");
                return;
            }

            let container = document.getElementById("mod_globe_innercontainer");
            let placeholder = document.getElementById("mod_globe_canvas_placeholder");

            // Create Globe
            try {
                this.globe = new this.ENCOM.Globe(placeholder.offsetWidth, placeholder.offsetHeight, {
                    font: window.theme.cssvars.font_main,
                    data: [],
                    tiles: this._geodata.tiles,
                    baseColor: window.theme.globe.base || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    markerColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    pinColor: window.theme.globe.pin || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    satelliteColor: window.theme.globe.satellite || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    scale: 1.1,
                    viewAngle: 0.630,
                    dayLength: 1000 * 45,
                    introLinesDuration: 2000,
                    introLinesColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                    maxPins: 300,
                    maxMarkers: 100
                });
            } catch (e) {
                console.error("Failed to create Globe instance:", e.message);
                return;
            }

            // Place Globe
            placeholder.remove();
            container.append(this.globe.domElement);

            // Init animations
            this._animate = () => {
                if (window.mods.globe.globe) {
                    window.mods.globe.globe.tick();
                }
                if (window.mods.globe._animate) {
                    setTimeout(() => {
                        try {
                            requestAnimationFrame(window.mods.globe._animate);
                        } catch (e) {
                            console.warn("Animation error:", e.message);
                        }
                    }, 1000 / 30);
                }
            };
            this.globe.init(window.theme.colors.light_black, () => {
                this._animate();
                window.audioManager.scan.play();
            });

            // resize handler
            this.resizeHandler = () => {
                let canvas = document.querySelector("div#mod_globe canvas");
                if (canvas && window.mods.globe.globe) {
                    window.mods.globe.globe.camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
                    window.mods.globe.globe.camera.updateProjectionMatrix();
                    window.mods.globe.globe.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
                }
            };
            window.addEventListener("resize", this.resizeHandler);

            // Connections
            this.conns = [];
            this.addConn = ip => {
                let data = null;
                try {
                    data = window.mods.netstat.geoLookup.get(ip);
                } catch {
                    // do nothing
                }
                let geo = (data !== null ? data.location : {});
                if (geo.latitude && geo.longitude && this.globe) {
                    const lat = Number(geo.latitude);
                    const lon = Number(geo.longitude);
                    window.mods.globe.conns.push({
                        ip,
                        pin: window.mods.globe.globe.addPin(lat, lon, "", 1.2),
                    });
                }
            };
            this.removeConn = ip => {
                let index = this.conns.findIndex(x => x.ip === ip);
                if (index !== -1 && this.conns[index].pin) {
                    this.conns[index].pin.remove();
                    this.conns.splice(index, 1);
                }
            };

            // Add random satellites
            let constellation = [];
            for (var i = 0; i < 2; i++) {
                for (var j = 0; j < 3; j++) {
                    constellation.push({
                        lat: 50 * i - 30 + 15 * Math.random(),
                        lon: 120 * j - 120 + 30 * i,
                        altitude: Math.random() * (1.7 - 1.3) + 1.3
                    });
                }
            }

            if (this.globe) {
                this.globe.addConstellation(constellation);
            }
        }, 2000);

        // Init updaters when intro animation is done
        setTimeout(() => {
            this.updateLoc();
            this.locUpdater = setInterval(() => {
                this.updateLoc();
            }, 1000);

            this.updateConns();
            this.connsUpdater = setInterval(() => {
                this.updateConns();
            }, 3000);
        }, 4000);
    }

    addRandomConnectedMarkers() {
        if (this.globe) {
            const randomLat = this.getRandomInRange(40, 90, 3);
            const randomLong = this.getRandomInRange(-180, 0, 3);
            this.globe.addMarker(randomLat, randomLong, '');
            this.globe.addMarker(randomLat - 20, randomLong + 150, '', true);
        }
    }
    addTemporaryConnectedMarker(ip) {
        if (this.globe) {
            let data = window.mods.netstat.geoLookup.get(ip);
            let geo = (data !== null ? data.location : {});
            if (geo.latitude && geo.longitude) {
                const lat = Number(geo.latitude);
                const lon = Number(geo.longitude);

                window.mods.globe.conns.push({
                    ip,
                    pin: window.mods.globe.globe.addPin(lat, lon, "", 1.2)
                });
                let mark = window.mods.globe.globe.addMarker(lat, lon, '', true);
                setTimeout(() => {
                    mark.remove();
                }, 3000);
            }
        }
    }
    removeMarkers() {
        if (this.globe && this.globe.markers) {
            this.globe.markers.forEach(marker => { marker.remove(); });
            this.globe.markers = [];
        }
    }
    removePins() {
        if (this.globe && this.globe.pins) {
            this.globe.pins.forEach(pin => {
                pin.remove();
            });
            this.globe.pins = [];
        }
    }
    getRandomInRange(from, to, fixed) {
        return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
    }
    updateLoc() {
        if (!this.globe) return;

        if (window.mods.netstat.offline) {
            document.querySelector("div#mod_globe").setAttribute("class", "offline");
            document.querySelector("i.mod_globe_headerInfo").innerText = "(OFFLINE)";

            this.removePins();
            this.removeMarkers();
            this.conns = [];
            this.lastgeo = {
                latitude: 0,
                longitude: 0
            };
        } else {
            this.updateConOnlineConnection().then(() => {
                document.querySelector("div#mod_globe").setAttribute("class", "");
            }).catch(() => {
                document.querySelector("i.mod_globe_headerInfo").innerText = "UNKNOWN";
            });
        }
    }
    async updateConOnlineConnection() {
        if (!this.globe) return;

        let newgeo = window.mods.netstat.ipinfo.geo;
        newgeo.latitude = Math.round(newgeo.latitude * 10000) / 10000;
        newgeo.longitude = Math.round(newgeo.longitude * 10000) / 10000;

        if (newgeo.latitude !== this.lastgeo.latitude || newgeo.longitude !== this.lastgeo.longitude) {
            document.querySelector("i.mod_globe_headerInfo").innerText = `${newgeo.latitude}, ${newgeo.longitude}`;
            this.removePins();
            this.removeMarkers();
            this.conns = [];

            this._locPin = this.globe.addPin(newgeo.latitude, newgeo.longitude, "", 1.2);
            this._locMarker = this.globe.addMarker(newgeo.latitude, newgeo.longitude, "", false, 1.2);
        }

        this.lastgeo = newgeo;
        document.querySelector("div#mod_globe").setAttribute("class", "");
    }
    updateConns() {
        if (!this.globe || window.mods.netstat.offline) return false;
        window.si.networkConnections().then(conns => {
            let newconns = [];
            conns.forEach(conn => {
                let ip = conn.peeraddress;
                let state = conn.state;
                if (state === "ESTABLISHED" && ip !== "0.0.0.0" && ip !== "127.0.0.1" && ip !== "::") {
                    newconns.push(ip);
                }
            });

            this.conns.forEach(conn => {
                if (newconns.indexOf(conn.ip) !== -1) {
                    newconns.splice(newconns.indexOf(conn.ip), 1);
                } else {
                    this.removeConn(conn.ip);
                }
            });

            newconns.forEach(ip => {
                this.addConn(ip);
            });
        });
    }
}

module.exports = {
    LocationGlobe
};