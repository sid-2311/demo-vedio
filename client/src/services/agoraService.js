import AgoraRTC from 'agora-rtc-sdk-ng';

// Default App ID or from environment variable VITE_AGORA_APP_ID
const DEFAULT_AGORA_APP_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AGORA_APP_ID) || 'a1b2c3d4e5f67890a1b2c3d4e5f67890'; // Placeholder App ID

class AgoraService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.remoteUsers = new Map();
    this.currentChannel = null;
    this.appId = DEFAULT_AGORA_APP_ID;

    // Set Agora logging level
    AgoraRTC.setLogLevel(1); // 0: DEBUG, 1: INFO, 2: WARNING, 3: ERROR
  }

  setAppId(appId) {
    if (appId && appId.trim()) {
      this.appId = appId.trim();
    }
  }

  getAppId() {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AGORA_APP_ID) || this.appId;
  }

  initClient() {
    if (!this.client) {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return this.client;
  }

  /**
   * Start local camera and audio tracks
   */
  async startLocalTracks() {
    try {
      if (this.localAudioTrack && this.localVideoTrack) {
        return { audioTrack: this.localAudioTrack, videoTrack: this.localVideoTrack };
      }

      console.log('[AGORA] Creating local microphone and camera tracks...');
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Automatic Noise Suppression
          AGC: true  // Automatic Gain Control
        },
        {
          encoderConfig: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: 30,
            bitrateMin: 300,
            bitrateMax: 800
          },
          facingMode: 'user'
        }
      );

      this.localAudioTrack = audioTrack;
      this.localVideoTrack = videoTrack;

      return { audioTrack, videoTrack };
    } catch (error) {
      console.error('[AGORA] Error creating local tracks:', error);
      throw error;
    }
  }

  /**
   * Play local video stream inside a HTML container element
   */
  playLocalVideo(elementIdOrRef) {
    if (this.localVideoTrack) {
      try {
        this.localVideoTrack.play(elementIdOrRef);
        console.log('[AGORA] Local video track playing in element:', elementIdOrRef);
      } catch (err) {
        console.warn('[AGORA] Local video play warning:', err);
      }
    }
  }

  /**
   * Join an Agora RTC Channel and publish tracks
   */
  async joinChannel({ channelName, uid = null, token = null, onUserJoined, onUserLeft, onUserMute }) {
    try {
      const activeAppId = this.getAppId();
      if (!activeAppId || activeAppId === 'YOUR_AGORA_APP_ID') {
        console.warn('[AGORA] Warning: Using placeholder Agora App ID. Please set VITE_AGORA_APP_ID in client/.env');
      }

      const client = this.initClient();
      this.currentChannel = channelName;

      // Event listeners for remote user published tracks
      client.on('user-published', async (user, mediaType) => {
        console.log(`[AGORA 📥] Remote user published track [UID: ${user.uid}, MediaType: ${mediaType}]`);
        await client.subscribe(user, mediaType);
        this.remoteUsers.set(user.uid, user);

        if (mediaType === 'video') {
          if (onUserJoined) onUserJoined(user, 'video');
        }

        if (mediaType === 'audio') {
          user.audioTrack?.play();
          if (onUserJoined) onUserJoined(user, 'audio');
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        console.log(`[AGORA 📤] Remote user unpublished track [UID: ${user.uid}, MediaType: ${mediaType}]`);
        if (mediaType === 'video') {
          if (onUserLeft) onUserLeft(user);
        }
        if (mediaType === 'audio') {
          if (onUserMute) onUserMute(user, true);
        }
      });

      client.on('user-left', (user, reason) => {
        console.log(`[AGORA 🛑] Remote user left channel [UID: ${user.uid}, Reason: ${reason}]`);
        this.remoteUsers.delete(user.uid);
        if (onUserLeft) onUserLeft(user);
      });

      // Join Agora Channel
      const numericOrStringUid = uid || Math.floor(Math.random() * 1000000);
      console.log(`[AGORA] Joining channel "${channelName}" with AppID: ${activeAppId}, UID: ${numericOrStringUid}...`);
      await client.join(activeAppId, channelName, token || null, numericOrStringUid);

      // Start local media tracks if not already started
      const { audioTrack, videoTrack } = await this.startLocalTracks();

      // Publish local tracks to channel
      console.log('[AGORA] Publishing local audio and video tracks to channel...');
      await client.publish([audioTrack, videoTrack]);
      console.log('[AGORA 🎉] Joined and Published successfully!');

      return { uid: numericOrStringUid, client };
    } catch (error) {
      console.error('[AGORA] Error joining Agora channel:', error);
      throw error;
    }
  }

  /**
   * Play remote user video inside a HTML container element
   */
  playRemoteVideo(user, containerElement) {
    if (user && user.videoTrack) {
      try {
        user.videoTrack.play(containerElement);
        console.log('[AGORA] Played remote video for user:', user.uid);
      } catch (err) {
        console.warn('[AGORA] Remote video play warning:', err);
      }
    }
  }

  /**
   * Toggle Audio Mute / Unmute
   */
  async setMuted(muted) {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(!muted);
      console.log(`[AGORA] Local Audio ${muted ? 'Muted 🔇' : 'Unmuted 🎙️'}`);
    }
  }

  /**
   * Toggle Camera On / Off
   */
  async setCameraOff(cameraOff) {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(!cameraOff);
      console.log(`[AGORA] Local Camera ${cameraOff ? 'Turned OFF 🚫' : 'Turned ON 📹'}`);
    }
  }

  /**
   * Leave current Agora channel and release tracks
   */
  async leaveChannel() {
    try {
      console.log('[AGORA 🛑] Leaving channel and releasing resources...');
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }
      if (this.client) {
        this.client.removeAllListeners();
        await this.client.leave();
        this.client = null;
      }
      this.remoteUsers.clear();
      this.currentChannel = null;
      console.log('[AGORA] Left channel cleanly.');
    } catch (error) {
      console.warn('[AGORA] Warning during leave channel:', error);
    }
  }
}

export const agoraService = new AgoraService();
