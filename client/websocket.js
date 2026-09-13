// Handles websocket connection to the server, auto-reconnecting, and sending/receiving messages

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

    console.log(`Connecting websocket to ${wsUrl}`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Tell server which room we are joining
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

        // Handle latency check response
        if (message.type === 'pong') {
          this.latency = Date.now() - message.clientTime;
          this.trigger('latency', { latency: this.latency });
          return;
        }

        this.trigger(message.type, message);
      } catch (err) {
        console.error('Failed to read incoming message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('Connection closed');
      this.isConnected = false;
      this.stopHeartbeat();
      this.trigger('disconnect');

      // Try reconnecting after a short delay if connection breaks
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(this.currentRoomId, this.userName), delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Websocket error:', err);
    };
  }

  // Measure ping latency to server every 3 seconds
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

  // Send message object to server as JSON
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
