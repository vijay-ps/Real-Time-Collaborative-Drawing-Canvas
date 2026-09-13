/**
 * Room Drawing State Manager
 * Maintains in-memory operation logs, active stroke streams, sequence numbers,
 * and global undo/redo states per room.
 */

class RoomDrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    // Monotonically increasing sequence counter per room
    this.nextSequence = 1;
    // Sequential vector operation log
    this.operations = []; // Array of { id, sequence, userId, userName, userColor, tool, points, color, size, text, timestamp, undone }
    // Global Undo stack tracking operation IDs
    this.undoStack = [];
    this.redoStack = [];
    // Currently active live stroke streams by streamId
    this.activeStreams = new Map();
    this.createdAt = Date.now();
    
    // Limits for performance & memory safety
    this.MAX_OPERATIONS = 10000;
  }

  /**
   * Returns complete state snapshot for late-joining and reconnecting clients
   */
  getSnapshot() {
    return {
      roomId: this.roomId,
      nextSequence: this.nextSequence,
      operations: this.operations.sort((a, b) => a.sequence - b.sequence),
      activeStreams: Array.from(this.activeStreams.values())
    };
  }

  /**
   * Start a live streaming stroke
   */
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

  /**
   * Append points to an ongoing live stream
   */
  appendStreamPoints(streamId, newPoints) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      // Input safety cap: max 5000 points per stroke
      if (stream.points.length < 5000) {
        stream.points.push(...newPoints.slice(0, 100));
      }
      return stream;
    }
    return null;
  }

  /**
   * Finalize a stroke stream into a permanent vector operation with server-assigned sequence number
   */
  endStream(streamId, finalOp) {
    this.activeStreams.delete(streamId);
    if (finalOp) {
      return this.addOperation(finalOp);
    }
    return null;
  }

  /**
   * Add a finalized vector operation to history with monotonic sequence number
   */
  addOperation(op) {
    // Memory limit safety: prune oldest undone operations if threshold exceeded
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
    
    // Clear redo stack on new operation (branching history rule)
    this.redoStack = [];
    return operation;
  }

  /**
   * Global Undo: Marks the most recent active (non-undone) operation as undone.
   * Server-authoritative sequence ordering.
   */
  undo(userId = null, targetOpId = null) {
    let targetOp = null;

    if (targetOpId) {
      targetOp = this.operations.find(op => op.id === targetOpId && !op.undone);
    } else if (userId) {
      // Undo user's own last active operation
      for (let i = this.operations.length - 1; i >= 0; i--) {
        if (this.operations[i].userId === userId && !this.operations[i].undone) {
          targetOp = this.operations[i];
          break;
        }
      }
    }

    // Fallback: Undo global last active operation in sequence
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

  /**
   * Global Redo: Re-enables the last undone operation
   */
  redo(userId = null) {
    let targetOp = null;

    if (this.redoStack.length > 0) {
      const lastUndoneId = this.redoStack.pop();
      targetOp = this.operations.find(op => op.id === lastUndoneId);
    } else {
      // Find last undone operation in sequence
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

  /**
   * Clear canvas for the room
   */
  clear(userId, userName) {
    const clearOp = {
      id: `op_clear_${Date.now()}`,
      sequence: this.nextSequence++,
      userId,
      userName,
      tool: 'clear',
      timestamp: Date.now(),
      undone: false
    };

    const clearedOpIds = [];
    this.operations.forEach(op => {
      if (!op.undone) {
        op.undone = true;
        clearedOpIds.push(op.id);
      }
    });

    this.operations.push(clearOp);
    this.undoStack.push(clearOp.id);
    this.redoStack = [];
    return { clearOp, clearedOpIds };
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
