/**
 * Main Application Coordinator
 * Connects Canvas Engine, WebSocket Client, DOM Toolbar UI, User List,
 * Modal Room Switcher, Keyboard Shortcuts, and Toast System.
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.canvasEngine;
  const ws = window.canvasWS;

  // App State
  let localUser = null;
  let currentRoomId = getRoomFromUrl() || 'default';

  // DOM Elements
  const roomDisplay = document.getElementById('current-room-display');
  const roomInfoBtn = document.getElementById('room-info-btn');
  const roomModal = document.getElementById('room-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const inputUserName = document.getElementById('input-user-name');
  const inputRoomId = document.getElementById('input-room-id');

  const strokeSlider = document.getElementById('stroke-width-slider');
  const strokeValDisplay = document.getElementById('stroke-width-val');
  const strokePreviewDot = document.getElementById('stroke-preview-dot');
  const nativeColorPicker = document.getElementById('native-color-picker');

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnClear = document.getElementById('btn-clear');
  const btnSave = document.getElementById('btn-save');

  const usersCountBadge = document.getElementById('users-count-badge');
  const usersAvatarsList = document.getElementById('users-avatars-list');
  const pingValDisplay = document.getElementById('ping-val');

  /* ==========================================================================
     URL & Room Initialization
     ========================================================================== */

  function getRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  }

  function setRoomInUrl(roomId) {
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
  }

  // Connect WebSocket to room
  roomDisplay.textContent = currentRoomId;
  ws.connect(currentRoomId);

  /* ==========================================================================
     WebSocket Event Handlers
     ========================================================================== */

  ws.on('room:joined', (data) => {
    localUser = data.user;
    engine.operations = data.snapshot.operations || [];
    engine.redrawAll();

    updateOnlineUsersList(data.onlineUsers);
    showToast(`Joined room "${currentRoomId}" as ${localUser.userName}`, 'info');
  });

  ws.on('user:joined', (data) => {
    updateOnlineUsersList(data.onlineUsers);
    showToast(`${data.user.userName} joined the canvas`, 'user');
  });

  ws.on('user:left', (data) => {
    updateOnlineUsersList(data.onlineUsers);
    engine.remoteCursors.delete(data.userId);
    showToast(`${data.userName} left the canvas`, 'info');
  });

  ws.on('cursor:moved', (data) => {
    engine.updateRemoteCursor(data.userId, data);
  });

  ws.on('stroke:started', (data) => {
    engine.remoteStreams.set(data.streamId, data.stream);
    engine.renderPreview();
  });

  ws.on('stroke:pointed', (data) => {
    const stream = engine.remoteStreams.get(data.streamId);
    if (stream) {
      if (!stream.points) stream.points = [];
      stream.points.push(...(data.points || []));
      engine.renderPreview();
    }
  });

  ws.on('op:committed', (data) => {
    for (const [sId, stream] of engine.remoteStreams.entries()) {
      if (stream.userId === data.operation.userId) {
        engine.remoteStreams.delete(sId);
      }
    }

    // Zero-flicker bridge: clear local pending stroke right as offscreen layer receives operation
    if (engine.pendingLocalStroke) {
      engine.pendingLocalStroke = null;
    }

    engine.operations.push(data.operation);
    engine.redrawAll();
    engine.renderPreview();
  });

  ws.on('op:undone', (data) => {
    engine.operations = data.operations;
    engine.redrawAll();
    showToast(`${data.userName} performed Undo ↩️`, 'action');
  });

  ws.on('op:redone', (data) => {
    engine.operations = data.operations;
    engine.redrawAll();
    showToast(`${data.userName} performed Redo ↪️`, 'action');
  });

  ws.on('room:cleared', (data) => {
    engine.operations = data.operations;
    engine.redrawAll();
    showToast(`${data.userName} cleared the canvas 🗑️`, 'action');
  });

  ws.on('latency', (data) => {
    if (pingValDisplay) {
      pingValDisplay.textContent = `${data.latency} ms`;
      pingValDisplay.style.color = data.latency < 80 ? '#059669' : data.latency < 180 ? '#D97706' : '#DC2626';
    }
  });

  /* ==========================================================================
     Online Users UI Renderer
     ========================================================================== */

  function updateOnlineUsersList(users) {
    if (!usersAvatarsList) return;

    usersCountBadge.textContent = `👥 ${users.length} Online`;
    usersAvatarsList.innerHTML = '';

    users.forEach(u => {
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.style.backgroundColor = u.userColor;
      avatar.title = `${u.userName}${u.userId === localUser?.userId ? ' (You)' : ''}`;
      avatar.textContent = u.userName ? u.userName.charAt(0).toUpperCase() : 'U';

      if (u.userId === localUser?.userId) {
        avatar.style.boxShadow = `0 0 0 2px #FFF`;
      }

      usersAvatarsList.appendChild(avatar);
    });
  }

  /* ==========================================================================
     Toolbar & UI Control Binding
     ========================================================================== */

  // Tool Selection Buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      engine.setTool(tool);
      showToast(`Tool: ${tool.toUpperCase()}`, 'info');
    });
  });

  // Fixed Top-Right Pan & Zoom Widget Controls
  const fixedPanBtn = document.getElementById('fixed-pan-btn');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnResetView = document.getElementById('btn-reset-view');

  if (fixedPanBtn) {
    fixedPanBtn.addEventListener('click', () => {
      const selectToolBtn = document.querySelector('.tool-btn[data-tool="select"]');
      if (selectToolBtn) selectToolBtn.click();
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      engine.zoomAt(undefined, undefined, 1.25);
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      engine.zoomAt(undefined, undefined, 0.8);
    });
  }

  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      engine.resetView();
      showToast('Reset view & zoom to 100%', 'info');
    });
  }

  if (btnResetView) {
    btnResetView.addEventListener('click', () => {
      engine.resetView();
      showToast('Centered canvas view', 'info');
    });
  }

  // Color Swatches
  document.querySelectorAll('.swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.dataset.color;
      engine.currentColor = color;
      nativeColorPicker.value = color;
      updateStrokePreview();
    });
  });

  nativeColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    engine.currentColor = color;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    updateStrokePreview();
  });

  // Stroke Slider
  strokeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    engine.strokeWidth = val;
    strokeValDisplay.textContent = `${val}px`;
    updateStrokePreview();
  });

  function updateStrokePreview() {
    if (strokePreviewDot) {
      const size = Math.min(20, Math.max(3, engine.strokeWidth));
      strokePreviewDot.style.width = `${size}px`;
      strokePreviewDot.style.height = `${size}px`;
      strokePreviewDot.style.backgroundColor = engine.currentColor;
    }
  }
  updateStrokePreview();

  // Action Buttons
  btnUndo.addEventListener('click', () => {
    if (ws.isConnected) {
      ws.send({ type: 'op:undo' });
    }
  });

  btnRedo.addEventListener('click', () => {
    if (ws.isConnected) {
      ws.send({ type: 'op:redo' });
    }
  });

  btnClear.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas for everyone in this room?')) {
      if (ws.isConnected) {
        ws.send({ type: 'room:clear' });
      }
    }
  });

  btnSave.addEventListener('click', () => {
    engine.exportImage(currentRoomId, `collaborative-canvas-${currentRoomId}.png`);
    showToast('Exported canvas to PNG! 💾', 'success');
  });

  /* ==========================================================================
     Room Modal Logic
     ========================================================================== */

  roomInfoBtn.addEventListener('click', () => {
    inputRoomId.value = currentRoomId;
    if (localUser) inputUserName.value = localUser.userName;
    roomModal.classList.add('active');
  });

  modalCloseBtn.addEventListener('click', () => {
    roomModal.classList.remove('active');
  });

  document.querySelectorAll('.btn-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inputRoomId.value = chip.dataset.room;
    });
  });

  btnJoinRoom.addEventListener('click', () => {
    const newRoom = inputRoomId.value.trim() || 'default';
    const newName = inputUserName.value.trim();

    if (newRoom !== currentRoomId || (localUser && newName !== localUser.userName)) {
      currentRoomId = newRoom;
      setRoomInUrl(currentRoomId);
      roomDisplay.textContent = currentRoomId;
      ws.connect(currentRoomId, newName);
    }
    roomModal.classList.remove('active');
  });

  /* ==========================================================================
     Keyboard Shortcuts
     ========================================================================== */

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          btnRedo.click();
        } else {
          btnUndo.click();
        }
        e.preventDefault();
      } else if (e.key === 'y' || e.key === 'Y') {
        btnRedo.click();
        e.preventDefault();
      }
      return;
    }

    const key = e.key.toLowerCase();
    const tools = { v: 'select', h: 'select', b: 'brush', e: 'eraser', l: 'line', r: 'rectangle', c: 'circle', t: 'text' };
    if (tools[key]) {
      const btn = document.querySelector(`.tool-btn[data-tool="${tools[key]}"]`);
      if (btn) btn.click();
    }
  });

  /* ==========================================================================
     Notification Toast System
     ========================================================================== */

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
});
