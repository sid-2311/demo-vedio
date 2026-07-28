"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const config_1 = require("./config");
const WorkerManager_1 = require("./managers/WorkerManager");
const RoomManager_1 = require("./managers/RoomManager");
const socketHandler_1 = require("./signaling/socketHandler");
async function bootstrap() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({ origin: '*' }));
    app.use(express_1.default.json());
    // Health Check API
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'mediasoup-sfu-server',
            timestamp: new Date().toISOString(),
        });
    });
    // Diagnostics API
    app.get('/api/diagnostics/:roomId', async (req, res) => {
        const { roomId } = req.params;
        const diagnostics = await RoomManager_1.roomManager.getRoomDiagnostics(roomId);
        if (!diagnostics) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(diagnostics);
    });
    let server;
    if (config_1.config.https.useHttps && fs_1.default.existsSync(config_1.config.https.sslKey) && fs_1.default.existsSync(config_1.config.https.sslCrt)) {
        const sslOptions = {
            key: fs_1.default.readFileSync(config_1.config.https.sslKey),
            cert: fs_1.default.readFileSync(config_1.config.https.sslCrt),
        };
        server = https_1.default.createServer(sslOptions, app);
        console.log('[Server] Initialized HTTPS secure server context');
    }
    else {
        server = http_1.default.createServer(app);
        console.log('[Server] Initialized HTTP server context');
    }
    // Initialize Socket.IO with WebSockets and Polling transport options
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    // Initialize Mediasoup Worker Pool
    await WorkerManager_1.workerManager.init();
    // Attach Signaling Handler
    (0, socketHandler_1.setupSocketHandler)(io);
    const port = config_1.config.https.port;
    const listenIp = config_1.config.https.listenIp;
    server.listen(port, listenIp, () => {
        console.log(`
============================================================
 MediaSoup SFU Server running at:
 ${config_1.config.https.useHttps ? 'https' : 'http'}://${listenIp}:${port}
 Protocol: ${config_1.config.https.useHttps ? 'WSS / HTTPS' : 'WS / HTTP'}
 Announced IP: ${config_1.config.mediasoup.webRtcTransportOptions.listenIps[0].announcedIp || 'auto/localhost'}
 RTC Port Range: ${config_1.config.mediasoup.workerSettings.rtcMinPort}-${config_1.config.mediasoup.workerSettings.rtcMaxPort}/udp
 Coturn Domain: ${config_1.config.turn.domain}:${config_1.config.turn.port}
============================================================
    `);
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('\n[Server] Shutting down server gracefully...');
        server.close(() => {
            console.log('[Server] Server closed. Exiting process.');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    console.error('[Server] Fatal Error during server bootstrap:', err);
    process.exit(1);
});
