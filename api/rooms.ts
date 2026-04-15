import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Multiplayer room management API backed by Vercel KV (Redis).
 * Rooms persist across cold starts. Auto-expire after 1 hour.
 */

// In-memory fallback when KV is not configured
const memRooms = new Map<string, any>();
const memPlayers = new Map<string, Map<string, any>>();

const PLAYER_TTL = 30000; // 30s stale timeout

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

let kvModule: any = null;
async function getKV() {
  if (kvModule) return kvModule;
  try {
    kvModule = await import("@vercel/kv");
    return kvModule;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const action = req.query.action as string | undefined;
  const roomId = req.query.id as string | undefined;

  const kvMod = await getKV();
  const useKV = kvMod && process.env.KV_REST_API_URL;

  try {
    // GET — list rooms
    if (req.method === "GET" && !roomId) {
      if (useKV) {
        const roomIds: string[] = (await kvMod.kv.smembers("minr:rooms")) ?? [];
        const rooms: any[] = [];
        for (const id of roomIds) {
          const room = await kvMod.kv.get(`minr:room:${id}`);
          if (!room) { await kvMod.kv.srem("minr:rooms", id); continue; }
          const pData = await kvMod.kv.hgetall(`minr:players:${id}`);
          rooms.push({ ...room, players: pData ? Object.keys(pData).length : 0 });
        }
        return res.json(rooms);
      } else {
        const rooms = Array.from(memRooms.values()).map(r => ({
          ...r, players: (memPlayers.get(r.id)?.size) ?? 0,
        }));
        return res.json(rooms);
      }
    }

    // GET — room detail
    if (req.method === "GET" && roomId) {
      if (useKV) {
        const room = await kvMod.kv.get(`minr:room:${roomId}`);
        if (!room) return res.status(404).json({ error: "Not found" });
        const pData = await kvMod.kv.hgetall(`minr:players:${roomId}`) ?? {};
        const players: any = {};
        const now = Date.now();
        for (const [n, raw] of Object.entries(pData)) {
          const s = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (now - s.lastSeen < PLAYER_TTL) players[n] = s;
        }
        return res.json({ ...room, players });
      } else {
        const room = memRooms.get(roomId);
        if (!room) return res.status(404).json({ error: "Not found" });
        const players = Object.fromEntries(memPlayers.get(roomId) ?? new Map());
        return res.json({ ...room, players });
      }
    }

    // POST
    if (req.method === "POST") {
      const body = req.body;

      // Create room
      if (!action) {
        const id = generateId();
        const room = { id, name: body.name || "Room " + id, host: body.host || "Player", created: Date.now() };
        if (useKV) {
          await kvMod.kv.set(`minr:room:${id}`, room, { ex: 3600 });
          await kvMod.kv.sadd("minr:rooms", id);
        } else {
          memRooms.set(id, room);
          memPlayers.set(id, new Map());
        }
        return res.json({ id, name: room.name });
      }

      // Join
      if (action === "join") {
        const state = { name: body.playerName, x: 0, y: 80, z: 0, yaw: 0, health: 20, tool: 1, lastSeen: Date.now() };
        if (useKV) {
          await kvMod.kv.hset(`minr:players:${body.roomId}`, { [body.playerName]: JSON.stringify(state) });
          await kvMod.kv.expire(`minr:players:${body.roomId}`, 3600);
        } else {
          if (!memPlayers.has(body.roomId)) memPlayers.set(body.roomId, new Map());
          memPlayers.get(body.roomId)!.set(body.playerName, state);
        }
        return res.json({ ok: true });
      }

      // State sync
      if (action === "state") {
        const newState = { name: body.playerName, ...body.state, lastSeen: Date.now() };

        if (useKV) {
          await kvMod.kv.hset(`minr:players:${body.roomId}`, { [body.playerName]: JSON.stringify(newState) });
          const allRaw = await kvMod.kv.hgetall(`minr:players:${body.roomId}`) ?? {};
          const others: any = {};
          const now = Date.now();
          for (const [n, raw] of Object.entries(allRaw)) {
            if (n === body.playerName) continue;
            const s: any = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (now - s.lastSeen < PLAYER_TTL) others[n] = s;
          }
          return res.json({ players: others });
        } else {
          if (!memPlayers.has(body.roomId)) memPlayers.set(body.roomId, new Map());
          memPlayers.get(body.roomId)!.set(body.playerName, newState);
          const others: any = {};
          for (const [n, s] of memPlayers.get(body.roomId)!) {
            if (n !== body.playerName) others[n] = s;
          }
          return res.json({ players: others });
        }
      }

      // Leave
      if (action === "leave") {
        if (useKV) {
          await kvMod.kv.hdel(`minr:players:${body.roomId}`, body.playerName);
        } else {
          memPlayers.get(body.roomId)?.delete(body.playerName);
        }
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
