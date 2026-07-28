"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIceServers = getIceServers;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
/**
 * Generates dynamic time-limited HMAC-SHA1 TURN credentials compatible with Coturn use-auth-secret.
 * @param usernamePrefix Identifier for the user/peer session
 */
function getIceServers(usernamePrefix = 'peer') {
    const unixTimeStamp = Math.floor(Date.now() / 1000) + config_1.config.turn.expirySeconds;
    const username = `${unixTimeStamp}:${usernamePrefix}`;
    const hmac = crypto_1.default.createHmac('sha1', config_1.config.turn.secret);
    hmac.update(username);
    const credential = hmac.digest('base64');
    const domain = config_1.config.turn.domain;
    const port = config_1.config.turn.port;
    const tlsPort = config_1.config.turn.tlsPort;
    return [
        // Standard public STUN server for local NAT discovery
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                `stun:${domain}:${port}`,
            ],
        },
        // Dynamic TURN over UDP (preferred for performance)
        {
            urls: [`turn:${domain}:${port}?transport=udp`],
            username,
            credential,
        },
        // Dynamic TURN over TCP (fallback when UDP is blocked by firewalls)
        {
            urls: [`turn:${domain}:${port}?transport=tcp`],
            username,
            credential,
        },
        // Dynamic TURN over TLS (port 5349 fallback for strict corporate proxies)
        {
            urls: [`turns:${domain}:${tlsPort}?transport=tcp`],
            username,
            credential,
        },
    ];
}
