import crypto from 'crypto';
import { config } from '../config';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Generates dynamic time-limited HMAC-SHA1 TURN credentials compatible with Coturn use-auth-secret.
 * @param usernamePrefix Identifier for the user/peer session
 */
export function getIceServers(usernamePrefix = 'peer'): IceServer[] {
  const unixTimeStamp = Math.floor(Date.now() / 1000) + config.turn.expirySeconds;
  const username = `${unixTimeStamp}:${usernamePrefix}`;
  
  const hmac = crypto.createHmac('sha1', config.turn.secret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  const domain = config.turn.domain;
  const port = config.turn.port;
  const tlsPort = config.turn.tlsPort;

  return [
    // Standard public STUN servers for NAT discovery
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:global.stun.twilio.com:3478',
        'stun:stun.services.mozilla.com',
      ],
    },
    // Metered OpenRelay public TURN fallback for NAT/Firewall traversal
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    // Dynamic TURN over UDP (if custom TURN domain configured)
    {
      urls: [`turn:${domain}:${port}?transport=udp`],
      username,
      credential,
    },
    // Dynamic TURN over TCP
    {
      urls: [`turn:${domain}:${port}?transport=tcp`],
      username,
      credential,
    },
    // Dynamic TURN over TLS
    {
      urls: [`turns:${domain}:${tlsPort}?transport=tcp`],
      username,
      credential,
    },
  ];
}
