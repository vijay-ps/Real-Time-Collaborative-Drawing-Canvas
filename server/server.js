const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const roomManager = require('./rooms');
const drawingState = require('./drawing-state');

const app = express();
let PORT = parseInt(process.env.PORT, 10) || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// Health & Status check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Create HTTP server
const server = http.createServer(app);

// Attach native WebSocket server
const wss = new WebSocketServer({ server });

// Input Validation Helpers
function isValidString(str, maxLength = 100) {
  return typeof str === 'string' && str.trim().length > 0 && str.length <= maxLength;
}

function isValidNumber(num, min = -10000, max = 10000) {
  return typeof num === 'number' && !isNaN(num) && num >= min && num <= max;
}

function sanitizeTool(tool) {
  const allowedTools = ['brush', 'eraser', 'line', 'rectangle', 'circle', 'text', 'clear'];
  return allowedTools.includes(tool) ? tool : 'brush';
}

wss.on('connection', (ws) => {
  let currentRoomId = 'default';

  ws.on('message', (messageRaw) => {
    try {
      // Safety cap: max 1MB per message payload
      if (messageRaw.length > 1024 * 1024) {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload size limit exceeded' }));
        return;
      }

      const data = JSON.parse(messageRaw.toString());
      if (!data || typeof data !== 'object' || !data.type) return;

      const { type } = data;

      switch (type) {
        case 'join': {
          const roomId = isValidString(data.roomId, 30) ? data.roomId.trim() : 'default';
          const userName = isValidString(data.userName, 25) ? data.userName.trim() : null;
          currentRoomId = roomId;

          const userData = roomManager.joinRoom(roomId, ws, userName);
          const state = drawingState.getRoomState(roomId);

          // Send snapshot payload with sequence numbers to client
          ws.send(JSON.stringify({
            type: 'room:joined',
            user: userData,
            snapshot: state.getSnapshot(),
            onlineUsers: roomManager.getRoomUsers(roomId)
          }));

          // Broadcast user join to existing clients in room
          roomManager.broadcastToRoom(roomId, {
            type: 'user:joined',
            user: userData,
            onlineUsers: roomManager.getRoomUsers(roomId)
          }, ws);
          break;
        }

        case 'cursor:move': {
          if (!isValidNumber(data.x) || !isValidNumber(data.y)) return;
          const userData = roomManager.getUserData(ws);
          if (userData) {
            userData.cursor = { x: data.x, y: data.y };
            userData.isDrawing = !!data.isDrawing;

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'cursor:moved',
              userId: userData.userId,
              userName: userData.userName,
              userColor: userData.userColor,
              x: data.x,
              y: data.y,
              isDrawing: data.isDrawing
            }, ws);
          }
          break;
        }

        case 'stroke:start': {
          if (!isValidString(data.streamId, 60)) return;
          const userData = roomManager.getUserData(ws);
          if (userData) {
            const state = drawingState.getRoomState(currentRoomId);
            const stream = state.startStream(data.streamId, {
              ...data,
              tool: sanitizeTool(data.tool),
              size: Math.min(100, Math.max(1, parseInt(data.size, 10) || 5)),
              userId: userData.userId,
              userName: userData.userName,
              userColor: userData.userColor
            });

            roomManager.broadcastToRoom(currentRoomId, {
              type: 'stroke:started',
              streamId: data.streamId,
              stream
            }, ws);
          }
          break;
        }

        case 'stroke:point': {
          if (!isValidString(data.streamId, 60) || !Array.isArray(data.points)) return;
          const state = drawingState.getRoomState(currentRoomId);
          const validPoints = data.points.filter(pt => pt && isValidNumber(pt.x) && isValidNumber(pt.y));

          if (validPoints.length > 0) {
            const updatedStream = state.appendStreamPoints(data.streamId, validPoints);
            if (updatedStream) {
              roomManager.broadcastToRoom(currentRoomId, {
                type: 'stroke:pointed',
                streamId: data.streamId,
                points: validPoints
              }, ws);
            }
          }
          break;
        }

        case 'stroke:end': {
          const userData = roomManager.getUserData(ws);
          if (userData && data.operation) {
            const state = drawingState.getRoomState(currentRoomId);
            const committedOp = state.endStream(data.streamId, {
              ...data.operation,
              tool: sanitizeTool(data.operation.tool),
              size: Math.min(100, Math.max(1, parseInt(data.operation.size, 10) || 5)),
              userId: userData.userId,
              userName: userData.userName,
              userColor: userData.userColor
            });

            if (committedOp) {
              roomManager.broadcastToAllInRoom(currentRoomId, {
                type: 'op:committed',
                operation: committedOp
              });
            }
          }
          break;
        }

        case 'op:undo': {
          const userData = roomManager.getUserData(ws);
          if (userData) {
            const state = drawingState.getRoomState(currentRoomId);
            const result = state.undo(data.userIdOnly ? userData.userId : null, data.targetOpId);

            if (result.success) {
              roomManager.broadcastToAllInRoom(currentRoomId, {
                type: 'op:undone',
                targetOpId: result.targetOpId,
                userId: userData.userId,
                userName: userData.userName,
                operations: state.getSnapshot().operations
              });
            }
          }
          break;
        }

        case 'op:redo': {
          const userData = roomManager.getUserData(ws);
          if (userData) {
            const state = drawingState.getRoomState(currentRoomId);
            const result = state.redo(userData.userId);

            if (result.success) {
              roomManager.broadcastToAllInRoom(currentRoomId, {
                type: 'op:redone',
                targetOpId: result.targetOpId,
                userId: userData.userId,
                userName: userData.userName,
                operations: state.getSnapshot().operations
              });
            }
          }
          break;
        }

        case 'room:clear': {
          const userData = roomManager.getUserData(ws);
          if (userData) {
            const state = drawingState.getRoomState(currentRoomId);
            const { clearOp, clearedOpIds } = state.clear(userData.userId, userData.userName);

            roomManager.broadcastToAllInRoom(currentRoomId, {
              type: 'room:cleared',
              clearOp,
              clearedOpIds,
              userId: userData.userId,
              userName: userData.userName,
              operations: state.getSnapshot().operations
            });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({
            type: 'pong',
            clientTime: data.clientTime,
            serverTime: Date.now()
          }));
          break;
        }

        default:
          console.warn('Unhandled message type:', type);
      }
    } catch (err) {
      console.error('Server error processing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const userData = roomManager.leaveRoom(ws);
    if (userData && currentRoomId) {
      roomManager.broadcastToRoom(currentRoomId, {
        type: 'user:left',
        userId: userData.userId,
        userName: userData.userName,
        onlineUsers: roomManager.getRoomUsers(currentRoomId)
      });
    }
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`🚀 Collaborative Canvas Server running at http://localhost:${portToTry}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Port ${PORT} is in use. Trying port ${PORT + 1}...`);
    PORT++;
    startServer(PORT);
  } else {
    console.error('Server error:', err);
  }
});

startServer(PORT);
