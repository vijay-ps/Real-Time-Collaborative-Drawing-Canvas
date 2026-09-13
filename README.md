# 🎨 Real-Time Collaborative Drawing Canvas

A high-performance, multi-user real-time drawing application built with **Vanilla JavaScript (HTML5 Canvas API)**, **Node.js**, **Express**, and native **WebSockets (`ws`)**. Multiple users can draw simultaneously on a shared vector canvas with live path streaming, smooth curves, remote user cursors, room isolation, and a global vector undo/redo history.

---

## 🌐 Live Production Links

- **🚀 Live Demo URL**: [https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/](https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/)
- **📁 GitHub Repository**: [https://github.com/vijay-ps/Real-Time-Collaborative-Drawing-Canvas](https://github.com/vijay-ps/Real-Time-Collaborative-Drawing-Canvas)
- **🎥 Video Demo Folder (Google Drive)**: [https://drive.google.com/drive/folders/1NLAx4XU6Cij5w9YYtnPhIfm4fSrnI7Vc?usp=sharing](https://drive.google.com/drive/folders/1NLAx4XU6Cij5w9YYtnPhIfm4fSrnI7Vc?usp=sharing)

> **Testing Multi-User Real-Time Sync**: Open the live demo link in two separate browser windows (or an Incognito tab / mobile device) to see real-time stroke streaming, live remote cursors, and global vector undo/redo in action!

---

## ✨ Implemented Features

- **Pure Canvas Operations**: Zero drawing libraries (no Fabric.js or Konva). Built with raw HTML5 Canvas 2D Context API and Midpoint Quadratic Bezier path smoothing.
- **Real-Time Stream Sync**: Streams live brush strokes as users draw (`stroke:start`, `stroke:point`, `stroke:end`) rather than waiting for stroke completion.
- **Remote User Cursors**: Shows live mouse/touch pointer positions with linear interpolation (Lerp) for smooth movement, custom user colors, and name tags (`User 1`, `User 2`).
- **Global Vector Undo/Redo**: Maintains a server-authoritative vector operation log. Undoing/redoing re-evaluates state deterministically across all connected clients.
- **User-Specific Content Clear**: The Clear button erases only the local user's own drawings from the canvas, leaving other participants' drawings intact.
- **Drawing & Shape Tools**: Brush (`B`), Eraser (`E`), Line (`L`), Rectangle (`R`), Circle (`C`), Text (`T`), and Pan/Cursor tool (`select` / `V`).
- **Stroke & Color Controls**: Dynamic stroke width slider (1px–50px) with live dot preview + palette swatches + native HTML5 color picker.
- **Room System**: Multi-room support via URL query parameters (`?room=art-studio`) or live in-app room switcher modal.
- **Telemetry HUD**: Real-time FPS counter (canvas `requestAnimationFrame` loop) and WebSocket RTT latency display (ping/pong).
- **PNG Image Export**: Export high-resolution PNG drawings directly to your device.
- **Keyboard Shortcuts**: Built-in computer hotkeys for tools (`V`/`H`, `B`, `E`, `L`, `R`, `C`, `T`) and Undo/Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`).
- **Responsive & Mobile Touch**: Full 2-finger touch pinch-to-zoom, 2-finger pan, and 1-finger touch drawing support on mobile devices and tablets.

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
| `V` or `H` | Select Pan / Move Cursor Tool |
| `B` | Select Brush Tool |
| `E` | Select Eraser Tool |
| `L` | Select Line Tool |
| `R` | Select Rectangle Tool |
| `C` | Select Circle Tool |
| `T` | Select Text Tool |
| `Ctrl` + `Z` / `Cmd` + `Z` | Global Undo |
| `Ctrl` + `Y` / `Ctrl` + `Shift` + `Z` | Global Redo |

---

## 🐛 Known Limitations & Edge Cases

1. **Large History Memory**: Vector operation replay iterates through history logs. For canvas sessions with over 10,000 continuous operations, history is capped and older undone ops are pruned.
2. **Text Editing**: Placed text is rendered directly onto the canvas as vector text. Editing pre-existing placed text inline is not supported; however, undoing text operations removes them cleanly.
3. **Pinch Zoom Sensitivity**: Mobile pinch-zoom scale factors are capped between 20% (`0.2x`) and 500% (`5.0x`) for stability.

---

## ⏱️ Time Spent

- **Architecture & System Design**: ~2.5 hours
- **Canvas Engine & Bezier Path Smoothing**: ~3.5 hours
- **WebSocket Protocol & Real-time State Sync**: ~3 hours
- **Global Undo/Redo & Monotonic Sequence Solver**: ~2.5 hours
- **UI Design, Light Theme Styling & UX**: ~2 hours
- **Testing, Documentation & Deployment**: ~2 hours
- **Total Time Spent**: ~15.5 hours
