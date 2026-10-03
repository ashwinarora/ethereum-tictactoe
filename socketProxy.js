// No-contact mode only: forwards Socket.IO traffic to the production game server.
//
// A no-contact deployment has no game engine of its own (see noContact.js), so the browser
// talks to its own origin and this passes /socket.io/ on, both the HTTP long-polling
// requests and the WebSocket upgrade. The backend's address stays on the server: nothing
// here may put it in a response.
const httpProxy = require('http-proxy');

const SOCKET_PATH = '/socket.io/';

/**
 * @param app         the express app. Call this before any body parser is added, so the
 *                    request bodies reach the backend untouched.
 * @param server      the http.Server the app listens on
 * @param backendUrl  origin of the game server, e.g. https://example.com
 */
module.exports = function attachSocketProxy(app, server, backendUrl) {
    const backendHost = new URL(backendUrl).host.toLowerCase();
    // changeOrigin: the backend's host routes on the Host header, so send its own name.
    const proxy = httpProxy.createProxyServer({ target: backendUrl, changeOrigin: true });

    // Drop any response header that names the backend (a redirect, a cookie domain, ...).
    proxy.on('proxyRes', (proxyRes) => {
        for (const [name, value] of Object.entries(proxyRes.headers)) {
            if (String(value).toLowerCase().includes(backendHost)) delete proxyRes.headers[name];
        }
    });

    // The error names the backend, so it is logged here and never sent to the browser.
    proxy.on('error', (err, req, res) => {
        console.log(`Socket proxy error: ${err.code || err.message}`);
        if (typeof res.writeHead !== 'function') return res.destroy(); // a WebSocket's raw socket
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
    });

    app.use((req, res, next) => {
        if (req.url.startsWith(SOCKET_PATH)) proxy.web(req, res);
        else next();
    });

    server.on('upgrade', (req, socket, head) => {
        if (req.url.startsWith(SOCKET_PATH)) proxy.ws(req, socket, head);
        else socket.destroy();
    });
};
