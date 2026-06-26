import { WebSocketServer, WebSocket } from "ws"
import { createServer } from "http";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

interface Client {
    room: string;
    name: string;
}

const clients = new Map<WebSocket, Client>();
const rooms = new Map<string, Set<WebSocket>>()

function generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomUserCount(room: string): number {
    return rooms.get(room)?.size ?? 0;
}

function broadCastToRoom(room: string, message: object, exclude?: WebSocket) {
    const roomClients = rooms.get(room);
    if (!roomClients) {
        return;
    }

    for (const clientSocket of roomClients) {
        if (clientSocket !== exclude && clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify(message));
        }
    }
}

function broadCastUserCount(room: string) {
    const count = getRoomUserCount(room);
    const roomClients = rooms.get(room);
    
    if (!roomClients) return;

    for (const clientSocket of roomClients) {
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ 
                type: "UserCount", 
                count
            }));
        }
    }
}

app.get("/health", (req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
})

app.post("/room/create", (req, res) => {
    const code = generateRoomCode();
    rooms.set(code, new Set());

    // Auto-delete if nobody joins in 5 minutes
    setTimeout(() => {
        rooms.delete(code);
        console.log(`Room ${code} expired (nobody joined)`);
    }, 5 * 60 * 1000);

    console.log(`Room creaded: ${code}`);
    res.json({ roomCode: code });
});

app.get("/room/:code", (req, res) => {
    const code = req.params.code;
    const exists = rooms.has(code);
    const UserCount = getRoomUserCount(code);
    res.json({ exists, UserCount });
});


const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
    console.log("New Client Connected");
    
    socket.on("message", (data) => {
        try {
            const parsedData = JSON.parse(data.toString());

            if (parsedData.type === "join") {
                const room: string = parsedData.room.toUpperCase();
                const name: string = parsedData.name ?? "Anonymous";
                
                clients.set(socket, { room, name });

                if (!rooms.has(room)) rooms.set(room, new Set());
                rooms.get(room)!.add(socket);
                    console.log(`${name} joined room: ${room}`);
                    
                socket.send(JSON.stringify({
                    type: "joined",
                    room,
                    message: `You joined room ${room}`,
                    userCount: getRoomUserCount(room),
                }));

                broadCastUserCount(room);
                broadCastToRoom(room, {
                    type: 'system',
                    message: `${name} joined the room`
                }, socket);

                return;
            }

            if (parsedData.type === "chat") {
                const client = clients.get(socket);
                if (!client) return;

                broadCastToRoom(client.room, {
                    type: "chat",
                    message: parsedData.message,
                    sender: client.name
                }, socket);
            }
        } catch (err) {
            console.log("Failed to parse message:", err);
            socket.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
    });

    socket.on("close", () => {
        const client = clients.get(socket);
        if (client) {
            const { room, name } = client;
            rooms.get(room)?.delete(socket);

            if (rooms.get(room)?.size === 0) {
                rooms.delete(room);
                console.log(`Room ${room} deleted (empty)`);;
            } else {
                broadCastUserCount(room);
                broadCastToRoom(room, {
                    type: "system",
                    message: `${name} left the room`
                })
            }
            clients.delete(socket);
        }
    });

    socket.on("error", (err) => console.log("WebSocket Error:", err))
});

server.listen(8080, () => {
    console.log("HTTP -> http://localhost:8080");
    console.log("WS -> http://localhost:8080");
});