/**
 * Real-Time WebSocket Client Connection Manager
 * Manages WebSocket connection lifecycle, heartbeats (ping/pong latency), auto-reconnect, and event routing.
 */

class CanvasWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.pingInterval = null;
    this.lastPingTime = 0;
    this.latency = 0;
    this.currentRoomId = 'default';
    this.userName = null;
  }

  connect(roomId = 'default', userName = null) {
    this.currentRoomId = roomId;
    if (userName) this.userName = userName;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log(`[WS] Connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connected successfully.');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Join requested room
      this.send({
        type: 'join',
        roomId: this.currentRoomId,
        userName: this.userName
      });

      this.startHeartbeat();
      this.trigger('connect', { roomId: this.currentRoomId });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'pong') {
          this.latency = Date.now() - message.clientTime;
          this.trigger('latency', { latency: this.latency });
          return;
        }

        this.trigger(message.type, message);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WS] Connection closed.');
      this.isConnected = false;
      this.stopHeartbeat();
      this.trigger('disconnect');

      // Auto-reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`[WS] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(this.currentRoomId, this.userName), delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] WebSocket error:', err);
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping', clientTime: this.lastPingTime });
      }
    }, 3000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  trigger(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(payload));
    }
  }
}

window.canvasWS = new CanvasWebSocket();
