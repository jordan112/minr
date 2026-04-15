/**
 * Multiplayer room management API.
 * Uses in-memory storage (resets on cold start — fine for demo).
 *
 * GET /api/rooms — list rooms
 * POST /api/rooms — create room { name, host }
 * POST /api/rooms?action=join — join room { roomId, playerName }
 * POST /api/rooms?action=signal — relay WebRTC signal { roomId, from, to, signal }
 * POST /api/rooms?action=state — update player state { roomId, playerName, state }
 * GET /api/rooms?id=xxx — get room state
 */

interface PlayerState {
  name: string;
  x: number; y: number; z: number;
  yaw: number;
  health: number;
  tool: number;
  lastSeen: number;
}

interface Room {
  id: string;
  name: string;
  host: string;
  players: Map<string, PlayerState>;
  signals: { from: string; to: string; signal: string; time: number }[];
  created: number;
}

// In-memory store (resets on cold start)
const rooms = new Map<string, Room>();

// Clean up old rooms (> 30 min)
function cleanup() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.created > 30 * 60 * 1000) rooms.delete(id);
    // Remove stale players (no update in 10s)
    for (const [name, p] of room.players) {
      if (now - p.lastSeen > 10000) room.players.delete(name);
    }
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default async function handler(req: Request): Promise<Response> {
  cleanup();
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const roomId = url.searchParams.get("id");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // GET /api/rooms — list rooms
  if (req.method === "GET" && !roomId) {
    const list = Array.from(rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      host: r.host,
      players: r.players.size,
      created: r.created,
    }));
    return new Response(JSON.stringify(list), { headers });
  }

  // GET /api/rooms?id=xxx — get room state
  if (req.method === "GET" && roomId) {
    const room = rooms.get(roomId);
    if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers });

    const players = Object.fromEntries(room.players);
    const signals = room.signals.splice(0); // drain signals
    return new Response(JSON.stringify({ id: room.id, name: room.name, players, signals }), { headers });
  }

  // POST handlers
  if (req.method === "POST") {
    const body: any = await req.json();
    {
      // Create room
      if (!action) {
        const id = generateId();
        const room: Room = {
          id,
          name: body.name || "Room " + id,
          host: body.host || "Player",
          players: new Map(),
          signals: [],
          created: Date.now(),
        };
        rooms.set(id, room);
        return new Response(JSON.stringify({ id, name: room.name }), { headers });
      }

      // Join room
      if (action === "join") {
        const room = rooms.get(body.roomId);
        if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers });
        room.players.set(body.playerName, {
          name: body.playerName,
          x: 0, y: 80, z: 0,
          yaw: 0, health: 20, tool: 1,
          lastSeen: Date.now(),
        });
        return new Response(JSON.stringify({ ok: true, players: room.players.size }), { headers });
      }

      // Update player state
      if (action === "state") {
        const room = rooms.get(body.roomId);
        if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers });
        const existing = room.players.get(body.playerName);
        room.players.set(body.playerName, {
          ...existing,
          name: body.playerName,
          ...body.state,
          lastSeen: Date.now(),
        });
        // Return other players' states
        const others: Record<string, PlayerState> = {};
        for (const [name, state] of room.players) {
          if (name !== body.playerName) others[name] = state;
        }
        return new Response(JSON.stringify({ players: others }), { headers });
      }

      // Relay WebRTC signal
      if (action === "signal") {
        const room = rooms.get(body.roomId);
        if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers });
        room.signals.push({
          from: body.from,
          to: body.to,
          signal: body.signal,
          time: Date.now(),
        });
        return new Response(JSON.stringify({ ok: true }), { headers });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
