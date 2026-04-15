import * as THREE from "three";

/**
 * Multiplayer Manager — polling-based position sync via Vercel API.
 *
 * How it works:
 * 1. Create or join a room (6-char code)
 * 2. Every 200ms, send your position to the server
 * 3. Server returns other players' positions
 * 4. Render other players as blocky characters
 */

interface RemotePlayer {
  name: string;
  x: number; y: number; z: number;
  yaw: number;
  health: number;
  mesh: THREE.Group | null;
  nameTag: THREE.Sprite | null;
}

export class MultiplayerManager {
  private roomId: string | null = null;
  private playerName: string;
  private remotePlayers = new Map<string, RemotePlayer>();
  private scene: THREE.Scene;
  private syncTimer = 0;
  private apiBase: string;
  isConnected = false;

  // UI elements
  private overlay: HTMLDivElement;
  private statusEl: HTMLDivElement;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.playerName = "Player_" + Math.random().toString(36).slice(2, 6);
    this.apiBase = window.location.origin;

    // Multiplayer status indicator
    this.statusEl = document.createElement("div");
    Object.assign(this.statusEl.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "11px",
      background: "rgba(0,0,0,0.5)",
      padding: "4px 8px",
      borderRadius: "4px",
      zIndex: "100",
      pointerEvents: "none",
      display: "none",
    });
    document.body.appendChild(this.statusEl);

    // Multiplayer menu overlay
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      background: "rgba(0,0,0,0.9)",
      padding: "24px",
      borderRadius: "10px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "14px",
      zIndex: "350",
      display: "none",
      minWidth: "320px",
      textAlign: "center",
    });
    document.body.appendChild(this.overlay);
  }

  showMenu(): void {
    if (this.overlay.style.display !== "none") {
      this.overlay.style.display = "none";
      return;
    }

    this.overlay.style.display = "block";
    this.overlay.innerHTML = `
      <div style="font-size:18px;font-weight:bold;margin-bottom:16px">MULTIPLAYER</div>
      <div style="margin-bottom:12px">
        <label>Your name: </label>
        <input id="mp-name" value="${this.playerName}" style="background:#333;color:white;border:1px solid #666;padding:4px 8px;font-family:monospace;width:120px">
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
        <button id="mp-create" style="padding:8px 16px;background:#336633;color:white;border:1px solid #44aa44;border-radius:4px;cursor:pointer;font-family:monospace">Create Room</button>
        <button id="mp-refresh" style="padding:8px 16px;background:#333366;color:white;border:1px solid #4444aa;border-radius:4px;cursor:pointer;font-family:monospace">Refresh List</button>
      </div>
      <div style="margin-bottom:12px">
        <label>Join code: </label>
        <input id="mp-code" placeholder="ABC123" style="background:#333;color:white;border:1px solid #666;padding:4px 8px;font-family:monospace;width:80px;text-transform:uppercase">
        <button id="mp-join" style="padding:4px 12px;background:#663333;color:white;border:1px solid #aa4444;border-radius:4px;cursor:pointer;font-family:monospace">Join</button>
      </div>
      <div id="mp-rooms" style="text-align:left;max-height:150px;overflow-y:auto;margin-top:8px"></div>
      <div style="margin-top:12px;font-size:11px;opacity:0.5">Press N to close</div>
    `;

    document.getElementById("mp-create")?.addEventListener("click", () => this.createRoom());
    document.getElementById("mp-join")?.addEventListener("click", () => {
      const code = (document.getElementById("mp-code") as HTMLInputElement)?.value;
      if (code) this.joinRoom(code.toUpperCase());
    });
    document.getElementById("mp-refresh")?.addEventListener("click", () => this.refreshRooms());
    this.refreshRooms();
  }

  private async refreshRooms(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/api/rooms`);
      const rooms = await res.json();
      const el = document.getElementById("mp-rooms");
      if (!el) return;
      if (rooms.length === 0) {
        el.innerHTML = "<div style='opacity:0.5'>No rooms. Create one!</div>";
        return;
      }
      el.innerHTML = rooms.map((r: any) =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #333">
          <span>${r.name} (${r.players} players)</span>
          <button onclick="document.getElementById('mp-code').value='${r.id}'" style="padding:2px 8px;background:#444;color:white;border:1px solid #666;border-radius:3px;cursor:pointer;font-size:11px">${r.id}</button>
        </div>`
      ).join("");
    } catch (e) {
      console.error("Failed to fetch rooms:", e);
    }
  }

  private async createRoom(): Promise<void> {
    this.playerName = (document.getElementById("mp-name") as HTMLInputElement)?.value || this.playerName;
    try {
      const res = await fetch(`${this.apiBase}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: this.playerName + "'s World", host: this.playerName }),
      });
      const data = await res.json();
      this.roomId = data.id;
      await this.joinRoom(data.id);
      this.overlay.style.display = "none";
    } catch (e) {
      console.error("Failed to create room:", e);
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    this.playerName = (document.getElementById("mp-name") as HTMLInputElement)?.value || this.playerName;
    try {
      const res = await fetch(`${this.apiBase}/api/rooms?action=join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, playerName: this.playerName }),
      });
      const data = await res.json();
      if (data.ok) {
        this.roomId = roomId;
        this.isConnected = true;
        this.overlay.style.display = "none";
        this.statusEl.style.display = "block";
        this.statusEl.textContent = `Online: ${roomId} (${this.playerName})`;
      }
    } catch (e) {
      console.error("Failed to join room:", e);
    }
  }

  update(dt: number, playerX: number, playerY: number, playerZ: number, playerYaw: number, health: number, tool: number): void {
    if (!this.isConnected || !this.roomId) return;

    this.syncTimer -= dt;
    if (this.syncTimer > 0) return;
    this.syncTimer = 0.2; // sync every 200ms

    // Send state and get others
    fetch(`${this.apiBase}/api/rooms?action=state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: this.roomId,
        playerName: this.playerName,
        state: { x: playerX, y: playerY, z: playerZ, yaw: playerYaw, health, tool },
      }),
    })
      .then(r => r.json())
      .then(data => {
        this.updateRemotePlayers(data.players || {});
        const count = Object.keys(data.players || {}).length + 1;
        this.statusEl.textContent = `Online: ${this.roomId} | ${count} players`;
      })
      .catch(() => {});
  }

  private updateRemotePlayers(players: Record<string, any>): void {
    // Update or create remote player meshes
    for (const [name, state] of Object.entries(players)) {
      let rp = this.remotePlayers.get(name);
      if (!rp) {
        rp = { name, x: state.x, y: state.y, z: state.z, yaw: state.yaw, health: state.health, mesh: null, nameTag: null };
        this.createRemotePlayerMesh(rp);
        this.remotePlayers.set(name, rp);
      }

      // Smooth interpolation
      rp.x += (state.x - rp.x) * 0.3;
      rp.y += (state.y - rp.y) * 0.3;
      rp.z += (state.z - rp.z) * 0.3;
      rp.yaw = state.yaw;
      rp.health = state.health;

      if (rp.mesh) {
        rp.mesh.position.set(rp.x, rp.y, rp.z);
        rp.mesh.rotation.y = rp.yaw + Math.PI;
      }
    }

    // Remove disconnected players
    for (const [name, rp] of this.remotePlayers) {
      if (!(name in players)) {
        if (rp.mesh) this.scene.remove(rp.mesh);
        this.remotePlayers.delete(name);
      }
    }
  }

  private createRemotePlayerMesh(rp: RemotePlayer): void {
    const group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0x33aa88 }); // teal to distinguish
    const shirt = new THREE.MeshLambertMaterial({ color: 0xcc6622 }); // orange shirt

    // Simple blocky player
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 1.55;
    group.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
    body.position.y = 0.975;
    group.add(body);

    // Arms
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), shirt);
      arm.position.set(s * 0.375, 0.95, 0);
      group.add(arm);
    }

    // Legs
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.27), new THREE.MeshLambertMaterial({ color: 0x333366 }));
      leg.position.set(s * 0.125, 0.3, 0);
      group.add(leg);
    }

    // Name tag
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = "#44ffaa";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(rp.name, 64, 22);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const nameTag = new THREE.Sprite(mat);
    nameTag.scale.set(1.5, 0.35, 1);
    nameTag.position.y = 2.1;
    group.add(nameTag);

    rp.mesh = group;
    rp.nameTag = nameTag;
    this.scene.add(group);
  }

  disconnect(): void {
    this.isConnected = false;
    this.roomId = null;
    this.statusEl.style.display = "none";
    for (const rp of this.remotePlayers.values()) {
      if (rp.mesh) this.scene.remove(rp.mesh);
    }
    this.remotePlayers.clear();
  }
}
