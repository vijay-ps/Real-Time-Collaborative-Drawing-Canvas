// Stores drawing state, stroke history, sequence order, and undo/redo per room

class RoomDrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    this.nextSequence = 1; // Order number for incoming drawing actions
    this.operations = []; // List of all drawing actions in this room
    this.undoStack = [];
    this.redoStack = [];
    this.activeStreams = new Map(); // Live drawing strokes in progress
    this.createdAt = Date.now();
    this.MAX_OPERATIONS = 10000;
  }

  // Get full room history for new users joining the room
  getSnapshot() {
    return {
      roomId: this.roomId,
      nextSequence: this.nextSequence,
      operations: this.operations.sort((a, b) => a.sequence - b.sequence),
      activeStreams: Array.from(this.activeStreams.values())
    };
  }

  // Start tracking a live stroke as user draws
  startStream(streamId, streamData) {
    const stream = {
      streamId,
      userId: streamData.userId,
      userName: streamData.userName,
      userColor: streamData.userColor,
      tool: streamData.tool,
      color: streamData.color,
      size: streamData.size,
      points: streamData.points || [],
      startTime: Date.now()
    };
    this.activeStreams.set(streamId, stream);
    return stream;
  }

  // Add incoming points to active live stroke
  appendStreamPoints(streamId, newPoints) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      if (stream.points.length < 5000) {
        stream.points.push(...newPoints.slice(0, 100));
      }
      return stream;
    }
    return null;
  }

  // Complete a stroke and save it to history
  endStream(streamId, finalOp) {
    this.activeStreams.delete(streamId);
    if (finalOp) {
      return this.addOperation(finalOp);
    }
    return null;
  }

  // Save drawing action to history list
  addOperation(op) {
    if (this.operations.length >= this.MAX_OPERATIONS) {
      this.operations.shift();
    }

    const operation = {
      id: op.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sequence: this.nextSequence++,
      userId: op.userId,
      userName: op.userName,
      userColor: op.userColor,
      tool: op.tool,
      color: op.color,
      size: op.size,
      points: op.points || [],
      startPoint: op.startPoint || null,
      endPoint: op.endPoint || null,
      text: op.text || null,
      timestamp: op.timestamp || Date.now(),
      undone: false
    };

    this.operations.push(operation);
    this.undoStack.push(operation.id);
    this.redoStack = [];
    return operation;
  }

  // Undo last active drawing action by user
  undo(userId = null, targetOpId = null) {
    let targetOp = null;

    if (targetOpId) {
      targetOp = this.operations.find(op => op.id === targetOpId && !op.undone);
    } else if (userId) {
      // Find user's own last action
      for (let i = this.operations.length - 1; i >= 0; i--) {
        if (this.operations[i].userId === userId && !this.operations[i].undone) {
          targetOp = this.operations[i];
          break;
        }
      }
    }

    // Fallback to last action overall
    if (!targetOp) {
      for (let i = this.operations.length - 1; i >= 0; i--) {
        if (!this.operations[i].undone) {
          targetOp = this.operations[i];
          break;
        }
      }
    }

    if (targetOp) {
      targetOp.undone = true;
      this.redoStack.push(targetOp.id);
      return { success: true, targetOpId: targetOp.id, operation: targetOp };
    }

    return { success: false, reason: 'Nothing to undo' };
  }

  // Redo last undone action
  redo(userId = null) {
    let targetOp = null;

    if (this.redoStack.length > 0) {
      const lastUndoneId = this.redoStack.pop();
      targetOp = this.operations.find(op => op.id === lastUndoneId);
    } else {
      for (let i = this.operations.length - 1; i >= 0; i--) {
        if (this.operations[i].undone) {
          targetOp = this.operations[i];
          break;
        }
      }
    }

    if (targetOp) {
      targetOp.undone = false;
      this.undoStack.push(targetOp.id);
      return { success: true, targetOpId: targetOp.id, operation: targetOp };
    }

    return { success: false, reason: 'Nothing to redo' };
  }

  // Clear drawings created by this user
  clear(userId, userName) {
    const clearedOpIds = [];
    this.operations.forEach(op => {
      if (op.userId === userId && !op.undone && op.tool !== 'clear') {
        op.undone = true;
        clearedOpIds.push(op.id);
      }
    });

    return { clearedOpIds };
  }
}

class DrawingState {
  constructor() {
    this.rooms = new Map();
  }

  getRoomState(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new RoomDrawingState(roomId));
    }
    return this.rooms.get(roomId);
  }
}

module.exports = new DrawingState();
