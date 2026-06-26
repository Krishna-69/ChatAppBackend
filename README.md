# Real Time Chat — Backend

WebSocket + Express server for the Real Time Chat app. Handles room creation, room validation via HTTP, and real-time messaging over WebSocket.

---

## Tech Stack

- **Node.js** + **TypeScript**
- **Express** — HTTP routes for room create/check
- **ws** — WebSocket server for real-time messaging
- **cors** — Cross-origin support for the frontend

---

## Project Structure

```
backend/
├── server.ts       # Entry point — Express + WebSocket server
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install express cors ws
npm install -D @types/express @types/cors @types/ws typescript ts-node
```

### 2. Run the server

```bash
npx ts-node server.ts
```

Server starts on:
- HTTP → `http://localhost:8080`
- WebSocket → `ws://localhost:8080`

---

## HTTP Routes

### `POST /room/create`

Creates a new room and returns a unique 6-character room code.

**Request**
```
POST http://localhost:8080/room/create
```

**Response**
```json
{
  "roomCode": "67CF81"
}
```

> Room auto-deletes after **5 minutes** if nobody joins via WebSocket.

---

### `GET /room/:code`

Checks whether a room exists and how many users are in it.

**Request**
```
GET http://localhost:8080/room/67CF81
```

**Response**
```json
{
  "exists": true,
  "userCount": 1
}
```

---

### `GET /health`

Health check endpoint.

**Response**
```json
{
  "status": "ok",
  "activeRooms": 3
}
```

---

## WebSocket Events

All WebSocket messages are JSON strings.

### Client → Server

#### `join` — Join a room
```json
{
  "type": "join",
  "room": "67CF81",
  "name": "Alice"
}
```

#### `chat` — Send a message
```json
{
  "type": "chat",
  "message": "Hello!"
}
```

---

### Server → Client

#### `joined` — Confirmed entry into room
```json
{
  "type": "joined",
  "room": "67CF81",
  "message": "You joined room 67CF81",
  "userCount": 1
}
```

#### `chat` — Incoming message from another user
```json
{
  "type": "chat",
  "message": "Hello!",
  "sender": "Alice"
}
```

#### `system` — System notification (user joined/left)
```json
{
  "type": "system",
  "message": "Alice joined the room"
}
```

#### `userCount` — Current user count in room
```json
{
  "type": "userCount",
  "count": 2
}
```

#### `error` — Invalid message format
```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

---

## Room Lifecycle

```
POST /room/create
      ↓
Room stored in memory (empty Set)
      ↓
User connects via WebSocket + sends "join"
      ↓
User added to room Set
      ↓
Both users chat in real time
      ↓
User disconnects → removed from Set
      ↓
Last user leaves → room deleted from memory
```

> Rooms are stored **in-memory** only. Restarting the server clears all rooms.
