import { Player } from "../player/Player";
import { World } from "../world/World";

const SAVE_KEY = "minr_save";
const AUTOSAVE_INTERVAL = 30; // seconds

export interface SaveData {
  version: 1;
  timestamp: number;
  player: {
    x: number; y: number; z: number;
    yaw: number; pitch: number;
    health: number; maxHealth: number;
    xp: number; level: number;
    selectedBlockIndex: number;
  };
  dayTime: number;
  // Only store blocks that differ from procedural generation
  blockChanges: { x: number; y: number; z: number; id: number }[];
}

export class SaveManager {
  private autosaveTimer = AUTOSAVE_INTERVAL;
  private saveIndicator: HTMLDivElement;

  constructor() {
    this.saveIndicator = document.createElement("div");
    Object.assign(this.saveIndicator.style, {
      position: "fixed",
      bottom: "10px",
      right: "10px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "12px",
      background: "rgba(0,0,0,0.5)",
      padding: "4px 8px",
      borderRadius: "4px",
      zIndex: "100",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(this.saveIndicator);
  }

  save(player: Player, world: World, dayTime: number): void {
    const changes = world.getBlockChanges();

    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
        pitch: player.pitch,
        health: player.health,
        maxHealth: player.maxHealth,
        xp: player.xp,
        level: player.level,
        selectedBlockIndex: player.selectedBlockIndex,
      },
      dayTime,
      blockChanges: changes,
    };

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.showIndicator("Game saved!");
    } catch (e) {
      this.showIndicator("Save failed!");
      console.error("Save failed:", e);
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1) return null;
      return data;
    } catch (e) {
      console.error("Load failed:", e);
      return null;
    }
  }

  applyLoad(data: SaveData, player: Player, world: World): number {
    // Restore player
    player.position.set(data.player.x, data.player.y, data.player.z);
    player.yaw = data.player.yaw;
    player.pitch = data.player.pitch;
    player.health = data.player.health;
    player.maxHealth = data.player.maxHealth;
    player.xp = data.player.xp;
    player.level = data.player.level;
    player.selectedBlockIndex = data.player.selectedBlockIndex;
    player.velocity.set(0, 0, 0);

    // Restore block changes
    world.applyBlockChanges(data.blockChanges);

    this.showIndicator("Game loaded!");

    return data.dayTime;
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    this.showIndicator("Save deleted!");
  }

  updateAutosave(dt: number, player: Player, world: World, dayTime: number): void {
    this.autosaveTimer -= dt;
    if (this.autosaveTimer <= 0) {
      this.autosaveTimer = AUTOSAVE_INTERVAL;
      this.save(player, world, dayTime);
    }
  }

  private showIndicator(text: string): void {
    this.saveIndicator.textContent = text;
    this.saveIndicator.style.opacity = "1";
    setTimeout(() => {
      this.saveIndicator.style.opacity = "0";
    }, 2000);
  }
}
