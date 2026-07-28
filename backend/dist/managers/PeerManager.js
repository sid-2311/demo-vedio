"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.peerManager = exports.PeerManager = exports.Peer = void 0;
class Peer {
    socketId;
    displayName;
    roomId;
    sendTransport;
    recvTransport;
    producers = new Map(); // producerId -> Producer
    consumers = new Map(); // consumerId -> Consumer
    constructor(socketId, displayName, roomId) {
        this.socketId = socketId;
        this.displayName = displayName;
        this.roomId = roomId;
    }
    addProducer(producer) {
        this.producers.set(producer.id, producer);
        producer.on('transportclose', () => {
            console.log(`[Peer ${this.socketId}] Producer ${producer.id} transport closed`);
            this.producers.delete(producer.id);
        });
    }
    getProducer(producerId) {
        return this.producers.get(producerId);
    }
    removeProducer(producerId) {
        const producer = this.producers.get(producerId);
        if (producer) {
            producer.close();
            this.producers.delete(producerId);
        }
    }
    addConsumer(consumer) {
        this.consumers.set(consumer.id, consumer);
        consumer.on('transportclose', () => {
            console.log(`[Peer ${this.socketId}] Consumer ${consumer.id} transport closed`);
            this.consumers.delete(consumer.id);
        });
        consumer.on('producerclose', () => {
            console.log(`[Peer ${this.socketId}] Consumer ${consumer.id} underlying producer closed`);
            this.consumers.delete(consumer.id);
        });
    }
    getConsumer(consumerId) {
        return this.consumers.get(consumerId);
    }
    removeConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (consumer) {
            consumer.close();
            this.consumers.delete(consumerId);
        }
    }
    close() {
        console.log(`[Peer ${this.socketId}] Closing all transports, producers, and consumers...`);
        this.producers.forEach((p) => p.close());
        this.producers.clear();
        this.consumers.forEach((c) => c.close());
        this.consumers.clear();
        if (this.sendTransport) {
            this.sendTransport.close();
            this.sendTransport = undefined;
        }
        if (this.recvTransport) {
            this.recvTransport.close();
            this.recvTransport = undefined;
        }
    }
}
exports.Peer = Peer;
class PeerManager {
    peers = new Map(); // socketId -> Peer
    addPeer(socketId, displayName, roomId) {
        const peer = new Peer(socketId, displayName, roomId);
        this.peers.set(socketId, peer);
        return peer;
    }
    getPeer(socketId) {
        return this.peers.get(socketId);
    }
    removePeer(socketId) {
        const peer = this.peers.get(socketId);
        if (peer) {
            peer.close();
            this.peers.delete(socketId);
        }
        return peer;
    }
    getPeersInRoom(roomId) {
        return Array.from(this.peers.values()).filter((p) => p.roomId === roomId);
    }
}
exports.PeerManager = PeerManager;
exports.peerManager = new PeerManager();
