# 🎨 Real-Time Collaborative Drawing Canvas

A multi-user real-time drawing application built with **Vanilla JavaScript (HTML5 Canvas API)**, **Node.js**, **Express**, and native **WebSockets (`ws`)**.

---

## 🌐 Live Production Links

- **🚀 Live Demo URL**: [https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/](https://realtime-collaborative-canvas-f51da8d7c6ed.herokuapp.com/)
- **📁 GitHub Repository**: [https://github.com/vijay-ps/Real-Time-Collaborative-Drawing-Canvas](https://github.com/vijay-ps/Real-Time-Collaborative-Drawing-Canvas)


---

## ✨ Features

- **Pure Canvas Operations**: Built with raw HTML5 Canvas 2D API (no Fabric.js or Konva) and Midpoint Bezier curve path smoothing.
- **Real-Time Sync**: Live stroke streaming as users draw (`stroke:start`, `stroke:point`, `stroke:end`).
- **Remote User Cursors**: Real-time remote cursor tracking with linear interpolation (Lerp) and user name badges (`User 1`, `User 2`).
- **Global Vector Undo/Redo**: Server-authoritative vector operation log maintaining canvas consistency across all users.
- **User-Specific Clear**: Clear button erases only the requesting user's drawings, leaving other participants' work intact.
- **Drawing Tools**: Brush (`B`), Eraser (`E`), Line (`L`), Rectangle (`R`), Circle (`C`), Text (`T`), and Pan/Cursor (`V`).
- **Stroke & Color Controls**: 1px–50px stroke width slider + palette swatches + native color picker.
- **Room System**: Multi-room isolation via URL query params (`?room=art-studio`) or room switcher modal.
- **Telemetry HUD**: Real-time FPS counter and WebSocket latency display (PING).
- **PNG Image Export**: Download high-resolution PNG snapshots of the canvas.
- **Responsive & Mobile Touch**: 2-finger touch pinch-to-zoom, 2-finger pan, and 1-finger touch drawing on mobile devices.

---

## 🛠️ Technical Architecture Highlights

- **3-Layer Canvas Engine**: 
  - `offscreen-canvas`: Holds all finalized, committed vector drawings.
  - `preview-canvas`: Renders active local/remote strokes in real-time with a zero-flicker bridge.
  - `cursor-canvas`: Renders remote user cursor pointers with 60 FPS linear interpolation (Lerp).
- **Network Optimization**: Points are batched every ~20ms to prevent WebSocket event flooding during fast mouse/touch moves.
- **Conflict Resolution**: Server assigns monotonic sequence numbers to incoming operations so all clients render overlapping strokes in exact sequence.
- **Mobile Gestures**: Native multi-touch gesture handlers support 2-finger pinch-to-zoom and 2-finger panning across mobile devices.

---

## 📁 Repository Structure

```
collaborative-canvas/
├── client/
│   ├── index.html        # DOM layout & toolbar
│   ├── style.css         # Light theme styles
│   ├── canvas.js         # HTML5 Canvas 2D engine & layer buffer
│   ├── websocket.js      # WebSocket client with ping/pong latency
│   └── main.js           # App initialization & UI handlers
├── server/
│   ├── server.js         # Express & WebSocket server
│   ├── rooms.js          # Room management & client identities
│   └── drawing-state.js  # Vector history log & global undo/redo solver
├── package.json          # Node.js dependencies
└── ARCHITECTURE.md       # Technical architecture & protocol details
```

---

## 🚀 Quick Start Guide

### 1. Installation

```bash
npm install
```

### 2. Run Application

```bash
npm start
```

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Multi-User Testing Guide

1. Open `http://localhost:3000` in **Browser A** and an Incognito window (**Browser B**).
2. Draw a stroke in Browser A — observe it stream live in Browser B as you draw.
3. Draw simultaneously in both windows to test real-time sequence conflict resolution.
4. Observe live remote cursor pointers gliding smoothly with user tags.
5. Press `Ctrl + Z` in Browser B to test global vector undo across users.
6. Switch Browser B to room `art-studio` via the room button to test room isolation.

---

## ⚙️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `V` or `H` | Select Pan / Move Cursor Tool |
| `B` | Select Brush Tool |
| `E` | Select Eraser Tool |
| `L` | Select Line Tool |
| `R` | Select Rectangle Tool |
| `C` | Select Circle Tool |
| `T` | Select Text Tool |
| `Ctrl` + `Z` / `Cmd` + `Z` | Global Undo |
| `Ctrl` + `Y` / `Ctrl` + `Shift` + `Z` | Global Redo |
