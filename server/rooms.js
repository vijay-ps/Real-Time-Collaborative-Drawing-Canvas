/**
 * Room & Client Session Manager
 * Manages WebSocket connections, user identities, vibrant colors, and room broadcasts.
 */

const USER_COLORS = [
  '#FF5722', // Vivid Orange
  '#E91E63', // Neon Pink
  '#9C27B0', // Deep Purple
  '#3F51B5', // Indigo
  '#00BCD4', // Electric Cyan
  '#009688', // Emerald Green
  '#8BC34A', // Lime Green
  '#FFEB3B', // Cyber Yellow
  '#FF9800', // Amber
  '#795548', // Warm Brown
  '#607D8B', // Blue Grey
  '#FF4081'  // Bright Accent Pink
];

const ADJECTIVES = ['Creative', 'Swift', 'Bright', 'Cosmic', 'Vibrant', 'Agile', 'Dynamic', 'Clever', 'Bold', 'Epic'];
const ANIMALS = ['Fox', 'Falcon', 'Panther', 'Otter', 'Lynx', 'Phoenix', 'Dolphin', 'Eagle', 'Koala', 'Tiger'];

class RoomManager {
  constructor() {
    // Room ID -> Map(ws -> userData)
    this.rooms = new Map();
    // WS -> { userId, userName, userColor, roomId, cursor: {x,y} }
    this.clients = new Map();
    this.colorIndex = 0;
  }

  generateUserIdentity() {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const userName = `${adj} ${animal}`;
    const userColor = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;
    return { userId, userName, userColor };
  }

  joinRoom(roomId, ws, customName = null) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const roomClients = this.rooms.get(roomId);
    let userData = this.clients.get(ws);

    if (!userData) {
      const identity = this.generateUserIdentity();
      userData = {
        ...identity,
        userName: customName || identity.userName,
        roomId,
        cursor: { x: 0, y: 0 },
        isDrawing: false
      };
      this.clients.set(ws, userData);
    } else {
      userData.roomId = roomId;
      if (customName) userData.userName = customName;
    }

    roomClients.set(ws, userData);
    return userData;
  }

  leaveRoom(ws) {
    const userData = this.clients.get(ws);
    if (!userData) return null;

    const { roomId } = userData;
    if (this.rooms.has(roomId)) {
      const roomClients = this.rooms.get(roomId);
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    this.clients.delete(ws);
    return userData;
  }

  getUserData(ws) {
    return this.clients.get(ws);
  }

  getRoomUsers(roomId) {
    if (!this.rooms.has(roomId)) return [];
    const users = [];
    for (const userData of this.rooms.get(roomId).values()) {
      users.push({
        userId: userData.userId,
        userName: userData.userName,
        userColor: userData.userColor,
        cursor: userData.cursor,
        isDrawing: userData.isDrawing
      });
    }
    return users;
  }

  broadcastToRoom(roomId, data, senderWs = null) {
    if (!this.rooms.has(roomId)) return;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const roomClients = this.rooms.get(roomId);

    for (const [ws, userData] of roomClients.entries()) {
      if (ws !== senderWs && ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(payload);
      }
    }
  }

  broadcastToAllInRoom(roomId, data) {
    this.broadcastToRoom(roomId, data, null);
  }
}

module.exports = new RoomManager();
