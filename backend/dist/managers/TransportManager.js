"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transportManager = exports.TransportManager = void 0;
const config_1 = require("../config");
const turnAuth_1 = require("../utils/turnAuth");
class TransportManager {
    /**
     * Creates a WebRtcTransport on the specified router for a given peer.
     */
    async createWebRtcTransport(router, socketId, direction) {
        const transportOptions = {
            ...config_1.config.mediasoup.webRtcTransportOptions,
        };
        const transport = await router.createWebRtcTransport(transportOptions);
        console.log(`[TransportManager] Created ${direction} WebRtcTransport [ID: ${transport.id}] for Peer ${socketId} on Router ${router.id}`);
        // Monitor ICE state changes for real-world network debugging
        transport.on('icestatechange', (iceState) => {
            console.log(`[TransportManager] Transport ${transport.id} (${direction}) ICE State -> ${iceState} [Peer: ${socketId}]`);
            if (iceState === 'failed' || iceState === 'disconnected') {
                console.warn(`[TransportManager] WARNING: Transport ${transport.id} ICE state degradation: ${iceState}. Inspecting active tuple...`, transport.iceSelectedTuple);
            }
        });
        transport.on('dtlsstatechange', (dtlsState) => {
            console.log(`[TransportManager] Transport ${transport.id} (${direction}) DTLS State -> ${dtlsState} [Peer: ${socketId}]`);
            if (dtlsState === 'failed' || dtlsState === 'closed') {
                console.warn(`[TransportManager] Transport ${transport.id} DTLS state closed/failed: ${dtlsState}`);
            }
        });
        // Generate dynamic STUN/TURN credentials for cross-network connectivity
        const iceServers = (0, turnAuth_1.getIceServers)(socketId);
        const params = {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
            iceServers,
        };
        return { transport, params };
    }
    /**
     * Triggers an ICE restart on an existing transport when switching networks (e.g. Wi-Fi to cellular).
     */
    async restartIce(transport) {
        console.log(`[TransportManager] Restarting ICE for transport ${transport.id}...`);
        const iceParameters = await transport.restartIce();
        return iceParameters;
    }
}
exports.TransportManager = TransportManager;
exports.transportManager = new TransportManager();
