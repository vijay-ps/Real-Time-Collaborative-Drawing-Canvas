// Manages user rooms, user names/colors, and sending messages to clients in a room

const USER_COLORS = [
  '#FF5722',
  '#E91E63',
  '#9C27B0',
  '#3F51B5',
  '#00BCD4',
  '#009688',
  '#8BC34A',
  '#FFEB3B',
  '#FF9800',
  '#795548',
  '#607D8B',
  '#FF4081'
];

class RoomManager {
  constructor() {
    this.rooms = new Map(); // Room ID -> Map of connected clients
    this.clients = new Map(); // Client connection -> user data
    this.colorIndex = 0;
    this.userCount = 0;
  }

  // Create default user name (User 1, User 2...) and color for new users
  generateUserIdentity() {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.userCount++;
    const userName = `User ${this.userCount}`;
    const userColor = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;
    return { userId, userName, userColor };
  }

  // Add client connection to a room
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

  // Remove client connection when disconnected
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

  // Send message to everyone in the room except the sender
  broadcastToRoom(roomId, data, senderWs = null) {
    if (!this.rooms.has(roomId)) return;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const roomClients = this.rooms.get(roomId);

    for (const [ws, userData] of roomClients.entries()) {
      if (ws !== senderWs && ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  // Send message to everyone in the room including sender
  broadcastToAllInRoom(roomId, data) {
    this.broadcastToRoom(roomId, data, null);
  }
}

module.exports = new RoomManager();
