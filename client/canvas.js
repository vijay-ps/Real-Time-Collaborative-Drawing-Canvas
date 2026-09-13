// Canvas Engine - Pure HTML5 Canvas API
// Handles rendering drawing layers, tool inputs, smooth paths, shapes, viewport pan/zoom, and remote user cursors.

class CanvasEngine {
  constructor() {
    // DOM Elements for the 3 canvas layers
    this.container = document.getElementById('canvas-container');
    this.offscreenCanvas = document.getElementById('offscreen-canvas'); // Main drawing layer
    this.previewCanvas = document.getElementById('preview-canvas');     // Active stroke preview layer
    this.cursorCanvas = document.getElementById('cursor-canvas');       // Remote user cursors layer

    // 2D Drawing Contexts
    this.offCtx = this.offscreenCanvas.getContext('2d');
    this.prevCtx = this.previewCanvas.getContext('2d');
    this.curCtx = this.cursorCanvas.getContext('2d');

    // Canvas Size & Scale
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    // Viewport Panning & Zoom Scale
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1.0;
    this.isPanning = false;
    this.lastPanScreenPoint = null;

    // Mobile Multi-Touch Pinch Zoom & Pan State
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoom = 1.0;
    this.pinchStartCenter = null;
    this.pinchStartPan = { x: 0, y: 0 };

    // Default Tool & Style (Pan / Cursor tool selected by default)
    this.currentTool = 'select'; // select, brush, eraser, line, rectangle, circle, text
    this.currentColor = '#2563EB';
    this.strokeWidth = 5;

    // Set initial cursor to grab for pan tool
    if (this.container) {
      this.container.style.cursor = 'grab';
    }

    // Local Drawing State
    this.isDrawing = false;
    this.currentPoints = [];
    this.pendingPointBatch = []; // Points waiting to be sent over network
    this.pendingLocalStroke = null; // Local preview stroke bridge
    this.startPoint = null;
    this.activeStreamId = null;

    // Remote User Drawing Streams & Cursors
    this.remoteStreams = new Map(); // streamId -> stroke details
    this.remoteCursors = new Map(); // userId -> cursor position

    // Drawing operations list from server
    this.operations = [];

    // FPS Counter Tracking
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.currentFps = 60;

    // Start listeners and loops
    this.initResize();
    this.bindPointerEvents();
    this.startNetworkBatchFlusher();
    this.startRenderLoop();
  }

  // Resize canvases when window resizes
  initResize() {
    const resize = () => {
      const rect = this.container.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;

      [this.offscreenCanvas, this.previewCanvas, this.cursorCanvas].forEach(canvas => {
        canvas.width = this.width * this.dpr;
        canvas.height = this.height * this.dpr;
        canvas.style.width = `${this.width}px`;
        canvas.style.height = `${this.height}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(this.dpr, this.dpr);
      });

      this.redrawAll();
    };

    window.addEventListener('resize', resize);
    resize();
  }

  // Bind mouse, touch, pointer, and wheel events
  bindPointerEvents() {
    const el = this.previewCanvas;

    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    el.addEventListener('pointerup', (e) => this.onPointerUp(e));
    el.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Mouse wheel zoom handler
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // Mobile Multi-Touch Pinch Zoom & Pan Gesture Listeners
    el.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    el.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    el.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    el.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
  }

  // Handle 2-finger touch pinch start on mobile
  onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.isPinching = true;
      this.isDrawing = false;
      this.isPanning = false;

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      this.pinchStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      this.pinchStartZoom = this.zoomLevel;

      const rect = this.previewCanvas.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      this.pinchStartCenter = { x: midX, y: midY };
      this.pinchStartPan = { x: this.panX, y: this.panY };
    }
  }

  // Handle 2-finger touch pinch movement and zoom scaling
  onTouchMove(e) {
    if (this.isPinching && e.touches.length === 2) {
      e.preventDefault();

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (this.pinchStartDistance <= 0) return;

      const scale = currentDist / this.pinchStartDistance;
      const newZoom = Math.max(0.2, Math.min(5.0, this.pinchStartZoom * scale));

      const rect = this.previewCanvas.getBoundingClientRect();
      const currentMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const currentMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const worldX = (this.pinchStartCenter.x - this.pinchStartPan.x) / this.pinchStartZoom;
      const worldY = (this.pinchStartCenter.y - this.pinchStartPan.y) / this.pinchStartZoom;

      this.zoomLevel = newZoom;
      this.panX = currentMidX - worldX * this.zoomLevel;
      this.panY = currentMidY - worldY * this.zoomLevel;

      this.updateZoomUI();
      this.redrawAll();
      this.renderPreview();
    }
  }

  onTouchEnd(e) {
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false;
      this.pinchStartDistance = 0;
      this.pinchStartCenter = null;
    }
  }

  // Calculate canvas coordinates taking panning and zoom into account
  getPointerCoords(e) {
    const rect = this.previewCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) - this.panX) / this.zoomLevel,
      y: ((e.clientY - rect.top) - this.panY) / this.zoomLevel
    };
  }

  // Change current tool
  setTool(tool) {
    this.currentTool = tool;
    if (tool === 'select') {
      this.container.style.cursor = 'grab';
    } else {
      this.container.style.cursor = 'crosshair';
    }
    this.updatePanWidgetUI();
  }

  updatePanWidgetUI() {
    const fixedPanBtn = document.getElementById('fixed-pan-btn');
    if (fixedPanBtn) {
      if (this.currentTool === 'select') {
        fixedPanBtn.classList.add('active');
      } else {
        fixedPanBtn.classList.remove('active');
      }
    }
  }

  // Zoom canvas centered around mouse position
  zoomAt(clientX, clientY, factor) {
    const rect = this.previewCanvas.getBoundingClientRect();
    const mouseX = clientX !== undefined ? (clientX - rect.left) : (this.width / 2);
    const mouseY = clientY !== undefined ? (clientY - rect.top) : (this.height / 2);

    const newZoom = Math.max(0.2, Math.min(5.0, this.zoomLevel * factor));
    if (newZoom === this.zoomLevel) return;

    const worldX = (mouseX - this.panX) / this.zoomLevel;
    const worldY = (mouseY - this.panY) / this.zoomLevel;

    this.zoomLevel = newZoom;
    this.panX = mouseX - worldX * this.zoomLevel;
    this.panY = mouseY - worldY * this.zoomLevel;

    this.updateZoomUI();
    this.redrawAll();
    this.renderPreview();
  }

  // Reset zoom to 100% and center view
  resetView() {
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateZoomUI();
    this.redrawAll();
    this.renderPreview();
  }

  updateZoomUI() {
    const display = document.getElementById('btn-zoom-reset');
    if (display) {
      display.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  // Pointer Down (start stroke or start pan)
  onPointerDown(e) {
    if (this.isPinching) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (this.currentTool === 'select') {
      this.isPanning = true;
      this.lastPanScreenPoint = { x: e.clientX, y: e.clientY };
      this.container.style.cursor = 'grabbing';
      return;
    }

    this.isDrawing = true;
    const pt = this.getPointerCoords(e);

    this.startPoint = pt;
    this.currentPoints = [pt];
    this.pendingPointBatch = [];
    this.pendingLocalStroke = null;
    this.activeStreamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Text tool prompts user for text string
    if (this.currentTool === 'text') {
      this.handleTextTool(pt);
      this.isDrawing = false;
      return;
    }

    // Send stroke start to server
    if (window.canvasWS && window.canvasWS.isConnected) {
      window.canvasWS.send({
        type: 'stroke:start',
        streamId: this.activeStreamId,
        tool: this.currentTool,
        color: this.currentColor,
        size: this.strokeWidth,
        points: [pt],
        startPoint: pt
      });
    }

    this.renderPreview();
  }

  // Pointer Move (drawing or panning)
  onPointerMove(e) {
    if (this.isPinching) return;
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanScreenPoint.x;
      const dy = e.clientY - this.lastPanScreenPoint.y;
      this.panX += dx;
      this.panY += dy;
      this.lastPanScreenPoint = { x: e.clientX, y: e.clientY };
      this.redrawAll();
      this.renderPreview();
      return;
    }

    const pt = this.getPointerCoords(e);

    // Send cursor movement to server
    if (window.canvasWS && window.canvasWS.isConnected) {
      window.canvasWS.send({
        type: 'cursor:move',
        x: pt.x,
        y: pt.y,
        isDrawing: this.isDrawing
      });
    }

    if (!this.isDrawing) return;

    this.currentPoints.push(pt);
    this.pendingPointBatch.push(pt);

    this.renderPreview();
  }

  // Pointer Up (finish stroke or pan)
  onPointerUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.container.style.cursor = 'grab';
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    const pt = this.getPointerCoords(e);
    if (this.currentPoints.length > 0) {
      this.currentPoints.push(pt);
      this.pendingPointBatch.push(pt);
    }

    this.flushPointBatch();

    const op = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tool: this.currentTool,
      color: this.currentColor,
      size: this.strokeWidth,
      points: [...this.currentPoints],
      startPoint: this.startPoint,
      endPoint: pt,
      timestamp: Date.now()
    };

    // Keep preview visible until server commit response arrives
    this.pendingLocalStroke = {
      streamId: this.activeStreamId,
      points: [...this.currentPoints],
      tool: this.currentTool,
      color: this.currentColor,
      size: this.strokeWidth,
      startPoint: this.startPoint,
      endPoint: pt
    };

    if (window.canvasWS && window.canvasWS.isConnected && this.activeStreamId) {
      window.canvasWS.send({
        type: 'stroke:end',
        streamId: this.activeStreamId,
        operation: op
      });
    } else {
      this.pendingLocalStroke = null;
      this.operations.push(op);
      this.redrawAll();
    }

    this.currentPoints = [];
    this.pendingPointBatch = [];
    this.startPoint = null;
    this.activeStreamId = null;
  }

  // Store target coordinates for smooth remote cursor movement
  updateRemoteCursor(userId, cursorData) {
    const existing = this.remoteCursors.get(userId);
    if (!existing) {
      this.remoteCursors.set(userId, {
        x: cursorData.x,
        y: cursorData.y,
        targetX: cursorData.x,
        targetY: cursorData.y,
        userName: cursorData.userName,
        userColor: cursorData.userColor,
        isDrawing: cursorData.isDrawing
      });
    } else {
      existing.targetX = cursorData.x;
      existing.targetY = cursorData.y;
      existing.userName = cursorData.userName;
      existing.userColor = cursorData.userColor;
      existing.isDrawing = cursorData.isDrawing;
    }
  }

  // Send pending drawing points over websocket every 20ms
  startNetworkBatchFlusher() {
    setInterval(() => {
      this.flushPointBatch();
    }, 20);
  }

  flushPointBatch() {
    if (this.pendingPointBatch.length > 0 && this.isDrawing && this.activeStreamId) {
      if (window.canvasWS && window.canvasWS.isConnected) {
        window.canvasWS.send({
          type: 'stroke:point',
          streamId: this.activeStreamId,
          points: this.pendingPointBatch
        });
      }
      this.pendingPointBatch = [];
    }
  }

  handleTextTool(pt) {
    const text = prompt('Enter text to place on canvas:', 'Collaborative Canvas');
    if (text && text.trim().length > 0) {
      const op = {
        id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tool: 'text',
        color: this.currentColor,
        size: Math.max(14, this.strokeWidth * 3),
        startPoint: pt,
        text: text.trim(),
        timestamp: Date.now()
      };

      if (window.canvasWS && window.canvasWS.isConnected) {
        window.canvasWS.send({
          type: 'stroke:end',
          streamId: `text_${Date.now()}`,
          operation: op
        });
      } else {
        this.operations.push(op);
        this.redrawAll();
      }
    }
  }

  // Draw smooth brush or eraser strokes using quadratic curves
  drawSmoothPath(ctx, points, color, size, isEraser = false) {
    if (!points || points.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : color;
      ctx.fill();
    } else if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else {
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw lines, rectangles, or circles
  drawShape(ctx, tool, startPt, endPt, color, size, isEraser = false) {
    if (!startPt || !endPt) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = color;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    const width = endPt.x - startPt.x;
    const height = endPt.y - startPt.y;

    switch (tool) {
      case 'line':
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(endPt.x, endPt.y);
        ctx.stroke();
        break;

      case 'rectangle':
        ctx.strokeRect(startPt.x, startPt.y, width, height);
        break;

      case 'circle': {
        const radiusX = Math.abs(width) / 2;
        const radiusY = Math.abs(height) / 2;
        const centerX = startPt.x + width / 2;
        const centerY = startPt.y + height / 2;

        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  // Render text on canvas
  drawText(ctx, pt, text, color, fontSize) {
    ctx.save();
    ctx.font = `500 ${fontSize}px Outfit, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(text, pt.x, pt.y);
    ctx.restore();
  }

  clearPreviewCtx() {
    this.prevCtx.save();
    this.prevCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.prevCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.prevCtx.restore();
  }

  clearOffscreenCtx() {
    this.offCtx.save();
    this.offCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.offCtx.restore();
  }

  // Redraw all committed drawings on the main offscreen layer
  redrawAll() {
    this.clearOffscreenCtx();

    this.offCtx.save();
    this.offCtx.translate(this.panX, this.panY);
    this.offCtx.scale(this.zoomLevel, this.zoomLevel);

    const activeOps = this.operations
      .filter(op => !op.undone)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    for (const op of activeOps) {
      if (op.tool === 'brush' || op.tool === 'eraser') {
        this.drawSmoothPath(this.offCtx, op.points, op.color, op.size, op.tool === 'eraser');
      } else if (op.tool === 'text') {
        this.drawText(this.offCtx, op.startPoint, op.text, op.color, op.size);
      } else if (op.tool === 'clear') {
        this.clearOffscreenCtx();
      } else {
        this.drawShape(this.offCtx, op.tool, op.startPoint, op.endPoint, op.color, op.size, false);
      }
    }

    this.offCtx.restore();
  }

  // Draw active strokes on preview layer
  renderPreview() {
    this.clearPreviewCtx();

    this.prevCtx.save();
    this.prevCtx.translate(this.panX, this.panY);
    this.prevCtx.scale(this.zoomLevel, this.zoomLevel);

    if (this.isDrawing) {
      if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
        this.drawSmoothPath(this.prevCtx, this.currentPoints, this.currentColor, this.strokeWidth, this.currentTool === 'eraser');
      } else if (this.startPoint && this.currentPoints.length > 0) {
        const currentPt = this.currentPoints[this.currentPoints.length - 1];
        this.drawShape(this.prevCtx, this.currentTool, this.startPoint, currentPt, this.currentColor, this.strokeWidth);
      }
    } else if (this.pendingLocalStroke) {
      const stroke = this.pendingLocalStroke;
      if (stroke.tool === 'brush' || stroke.tool === 'eraser') {
        this.drawSmoothPath(this.prevCtx, stroke.points, stroke.color, stroke.size, stroke.tool === 'eraser');
      } else if (stroke.startPoint && stroke.endPoint) {
        this.drawShape(this.prevCtx, stroke.tool, stroke.startPoint, stroke.endPoint, stroke.color, stroke.size);
      }
    }

    for (const stream of this.remoteStreams.values()) {
      if (stream.tool === 'brush' || stream.tool === 'eraser') {
        this.drawSmoothPath(this.prevCtx, stream.points, stream.color, stream.size, stream.tool === 'eraser');
      } else if (stream.startPoint && stream.points && stream.points.length > 0) {
        const lastPt = stream.points[stream.points.length - 1];
        this.drawShape(this.prevCtx, stream.tool, stream.startPoint, lastPt, stream.color, stream.size);
      }
    }

    this.prevCtx.restore();
  }

  // Draw remote user cursors smoothly
  renderCursors() {
    this.curCtx.save();
    this.curCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.curCtx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
    this.curCtx.restore();

    this.curCtx.save();
    this.curCtx.translate(this.panX, this.panY);
    this.curCtx.scale(this.zoomLevel, this.zoomLevel);

    for (const [userId, cursor] of this.remoteCursors.entries()) {
      if (typeof cursor.targetX !== 'number' || typeof cursor.targetY !== 'number') continue;

      if (typeof cursor.x !== 'number') cursor.x = cursor.targetX;
      if (typeof cursor.y !== 'number') cursor.y = cursor.targetY;

      // Smooth cursor movement interpolation
      cursor.x += (cursor.targetX - cursor.x) * 0.35;
      cursor.y += (cursor.targetY - cursor.y) * 0.35;

      const { x, y, userName, userColor, isDrawing } = cursor;
      this.curCtx.save();

      // Pointer circle
      this.curCtx.beginPath();
      this.curCtx.arc(x, y, isDrawing ? 8 : 5, 0, Math.PI * 2);
      this.curCtx.fillStyle = userColor;
      this.curCtx.shadowColor = 'rgba(0,0,0,0.15)';
      this.curCtx.shadowBlur = 6;
      this.curCtx.fill();

      if (isDrawing) {
        this.curCtx.beginPath();
        this.curCtx.arc(x, y, 14, 0, Math.PI * 2);
        this.curCtx.strokeStyle = userColor;
        this.curCtx.lineWidth = 1.5;
        this.curCtx.stroke();
      }

      // Name tag
      const tagText = userName || 'Artist';
      this.curCtx.font = '600 11px Outfit, sans-serif';
      const textWidth = this.curCtx.measureText(tagText).width;
      const pillWidth = textWidth + 16;
      const pillHeight = 22;
      const pillX = x + 12;
      const pillY = y + 12;

      this.curCtx.fillStyle = userColor;
      this.curCtx.beginPath();
      this.curCtx.roundRect ? this.curCtx.roundRect(pillX, pillY, pillWidth, pillHeight, 10)
                            : this.curCtx.rect(pillX, pillY, pillWidth, pillHeight);
      this.curCtx.fill();

      this.curCtx.fillStyle = '#FFFFFF';
      this.curCtx.textBaseline = 'middle';
      this.curCtx.fillText(tagText, pillX + 8, pillY + pillHeight / 2);

      this.curCtx.restore();
    }

    this.curCtx.restore();
  }

  // Animation frame render loop & FPS calculation
  startRenderLoop() {
    const loop = (timestamp) => {
      this.frameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;

        const fpsEl = document.getElementById('fps-val');
        if (fpsEl) fpsEl.textContent = `${this.currentFps}`;
      }

      this.renderCursors();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  // Export current drawing to PNG image
  exportImage(roomName = 'default', filename = 'collaborative-drawing.png') {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width * this.dpr;
    tempCanvas.height = this.height * this.dpr;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill white background
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(this.offscreenCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = filename;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }
}

window.canvasEngine = new CanvasEngine();
