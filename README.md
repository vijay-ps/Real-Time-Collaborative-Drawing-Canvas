# 🎨 Real-Time Collaborative Drawing Canvas

A high-performance, multi-user real-time drawing application built with **Vanilla JavaScript (HTML5 Canvas API)**, **Node.js**, **Express**, and native **WebSockets (`ws`)**. Multiple users can draw simultaneously on a shared vector canvas with live path streaming, smooth curves, remote user cursors, room isolation, and a global vector undo/redo history.

---

## 🌐 Live Production Demo & Video Walkthrough

### 🚀 **Live Demo URL**: [https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/](https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/)

### 🎥 **Video Demo Folder (Google Drive)**: [https://drive.google.com/drive/folders/1NLAx4XU6Cij5w9YYtnPhIfm4fSrnI7Vc?usp=sharing](https://drive.google.com/drive/folders/1NLAx4XU6Cij5w9YYtnPhIfm4fSrnI7Vc?usp=sharing)

> **Testing Multi-User Real-Time Sync**: Open the live demo link in two separate browser windows (or an Incognito tab / mobile device) to see real-time stroke streaming, live remote cursors, and global vector undo/redo in action!

---

## ✨ Features

- **Pure Canvas Operations**: Zero drawing libraries (no Fabric.js/Konva). Implemented raw HTML5 Canvas API with Midpoint Quadratic Bezier path smoothing.
- **Real-Time Stream Sync**: Streams live brush strokes as users draw (`stroke:start`, `stroke:point`, `stroke:end`) rather than waiting for stroke completion.
- **Remote User Cursors**: Shows live mouse/touch pointer positions with linear interpolation (Lerp) for silky smooth movement, custom user colors, and name tags.
- **Global Vector Undo/Redo**: Maintains a global vector operation log that re-evaluates canvas state deterministically when operations are undone or redone.
- **Drawing Tools**: Brush, Eraser, Line, Rectangle, Circle, and Interactive Text placement.
- **Stroke & Color Controls**: Dynamic stroke width slider with live dot preview + palette swatches + native HTML5 color picker.
- **Room System**: Multi-room support via URL query parameters (`?room=art-studio`) or live in-app room switcher modal.
- **Telemetry HUD**: Real-time FPS counter and WebSocket RTT latency display (ping/pong).
- **Watermarked Image Export**: Export high-resolution composite PNG drawings with room name and timestamp watermark.
- **Keyboard Shortcuts Guide**: Interactive modal (`?` hotkey) displaying all tool and action hotkeys.
- **Responsive & Touch Enabled**: Supports touch events (`pointerdown`, `pointermove`, `pointerup`) on mobile devices and tablets with disabled pull-to-refresh gestures.

---

## 📁 Repository Structure

```
collaborative-canvas/
├── client/
│   ├── index.html        # Main DOM layout, header, floating toolbar & modals
│   ├── style.css         # Modern Light Theme CSS & responsive breakpoints
│   ├── canvas.js         # Pure Canvas API engine, layer buffer, path smoothing & lerp
│   ├── websocket.js      # WebSocket client with ping/pong latency & auto-reconnect
│   └── main.js           # App controller, toolbar bindings & shortcut listeners
├── server/
│   ├── server.js         # Express HTTP + Native WebSocket server initialization
│   ├── rooms.js          # Room lifecycle, user identities & broadcast manager
│   └── drawing-state.js  # Vector history log & global undo/redo state solver
├── package.json          # Node.js dependencies (express, ws) and start script
├── Procfile              # Heroku deployment entrypoint
├── README.md             # Project overview, setup, and multi-user testing guide
└── ARCHITECTURE.md       # Detailed technical architecture, protocol & data flow
```

---

## 🚀 Quick Start Guide

### 1. Installation

Ensure you have **Node.js (v18+)** installed.

```bash
# Install dependencies
npm install
```

### 2. Run Application

```bash
# Start server
npm start
```

The application will be running at: **`http://localhost:3000`**

---

## 🧪 Multi-User Verification Checklist

Run through these 8 test scenarios to verify application correctness:

1. **Basic Drawing Test**: Draw a stroke in Browser A. Verify it appears smoothly on your screen immediately (Client Prediction).
2. **Live Remote Sync Test**: Open Browser B side-by-side with Browser A. Draw in Browser A and observe the stroke streaming in real-time in Browser B *while* drawing.
3. **Simultaneous Overlapping Strokes**: Draw overlapping strokes simultaneously in Browser A and B. Both browsers converge to the exact same visual state (Server Sequence Resolution).
4. **Remote Cursor Tracking Test**: Move mouse in Browser A. Browser B displays User A's avatar tag and cursor ring moving smoothly in real-time (Linear Interpolation).
5. **User Presence Test**: Join Browser A and Browser B. Verify the Online Users count reads `👥 2 Online` with distinct user color badges.
6. **Global Undo/Redo Test**:
   - User A draws stroke A1.
   - User B draws stroke B1.
   - User B clicks **Undo** (or `Ctrl+Z`).
   - Operation B1 is undone on **both** browsers.
7. **Reconnection & Late-Joiner Test**: Open a new tab Browser C after drawing operations exist. Browser C instantly fetches the server snapshot and replays all vector operations.
8. **Room Isolation Test**: Switch Browser B to room `playground` using the room pill button. Drawings in room `playground` do not leak into room `default`.

---

## ⚙️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `B` | Select Brush Tool |
| `E` | Select Eraser Tool |
| `L` | Select Line Tool |
| `R` | Select Rectangle Tool |
| `C` | Select Circle Tool |
| `T` | Select Text Tool |
| `Ctrl` + `Z` | Global Undo |
| `Ctrl` + `Y` / `Ctrl` + `Shift` + `Z` | Global Redo |
| `?` or `Shift` + `/` | Toggle Keyboard Shortcuts Modal |

---

## 🐛 Known Limitations & Edge Cases

1. **Large History Memory**: Vector operation replay iterates through history logs. For canvas sessions with over 10,000 continuous operations, history is capped and older undone ops are pruned.
2. **Text Editing**: Placed text is rendered directly onto the canvas as vector text. Editing pre-existing placed text inline is not supported; however, undoing text operations removes them cleanly.
3. **Simultaneous Mobile Pinch-Zoom**: Browser viewport scaling on mobile devices is disabled (`user-scalable=no`) to ensure smooth touch drawing without triggering native page zoom.

---

## ⏱️ Time Spent

- **Architecture & System Design**: ~2.5 hours
- **Canvas Engine & Bezier Path Smoothing**: ~3.5 hours
- **WebSocket Protocol & Real-time State Sync**: ~3 hours
- **Global Undo/Redo & Monotonic Sequence Solver**: ~2.5 hours
- **UI Design, Light Theme Styling & UX**: ~2 hours
- **Testing, Documentation & Deployment**: ~2 hours
- **Total Time Spent**: ~15.5 hours
