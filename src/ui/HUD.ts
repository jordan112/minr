import { BlockId, getBlockDef, PLACEABLE_BLOCKS } from "../world/BlockType";
import { Player } from "../player/Player";
import { ToolType, ALL_TOOLS, getToolDef } from "../player/ToolSystem";

export class HUD {
  private debugEl: HTMLDivElement;
  private blockBar: HTMLDivElement;
  private toolBar: HTMLDivElement;
  private healthBar: HTMLDivElement;
  private healthFill: HTMLDivElement;
  private healthText: HTMLDivElement;
  private dayIndicator: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private audioIndicator: HTMLDivElement;
  private showDebug = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fpsDisplay = 0;
  private toolSlots: HTMLElement[] = [];
  private currentTool: ToolType = ToolType.PICKAXE;

  constructor() {
    // Crosshair
    this.crosshair = document.createElement("div");
    Object.assign(this.crosshair.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      color: "white",
      fontSize: "24px",
      fontFamily: "monospace",
      pointerEvents: "none",
      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
      zIndex: "100",
      mixBlendMode: "difference",
    });
    this.crosshair.textContent = "+";
    document.body.appendChild(this.crosshair);

    // Health bar
    this.healthBar = document.createElement("div");
    Object.assign(this.healthBar.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "200px",
      height: "20px",
      background: "rgba(0,0,0,0.5)",
      borderRadius: "10px",
      overflow: "hidden",
      border: "2px solid rgba(255,255,255,0.3)",
      zIndex: "100",
    });
    document.body.appendChild(this.healthBar);

    this.healthFill = document.createElement("div");
    Object.assign(this.healthFill.style, {
      width: "100%",
      height: "100%",
      background: "linear-gradient(90deg, #cc2222, #ff4444)",
      transition: "width 0.2s",
      borderRadius: "8px",
    });
    this.healthBar.appendChild(this.healthFill);

    this.healthText = document.createElement("div");
    Object.assign(this.healthText.style, {
      position: "fixed",
      top: "22px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "white",
      fontFamily: "monospace",
      fontSize: "12px",
      fontWeight: "bold",
      textShadow: "1px 1px 2px black",
      zIndex: "101",
      pointerEvents: "none",
    });
    document.body.appendChild(this.healthText);

    // Day/night indicator
    this.dayIndicator = document.createElement("div");
    Object.assign(this.dayIndicator.style, {
      position: "fixed",
      top: "46px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "white",
      fontFamily: "monospace",
      fontSize: "11px",
      textShadow: "1px 1px 2px black",
      zIndex: "100",
      pointerEvents: "none",
    });
    document.body.appendChild(this.dayIndicator);

    // Tool bar (top of block bar)
    this.toolBar = document.createElement("div");
    Object.assign(this.toolBar.style, {
      position: "fixed",
      bottom: "72px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "4px",
      padding: "4px 6px",
      background: "rgba(0,0,0,0.5)",
      borderRadius: "6px",
      zIndex: "100",
    });
    document.body.appendChild(this.toolBar);

    // Tool slots
    const toolIcons: Record<ToolType, string> = {
      [ToolType.HAND]: "\u270b",
      [ToolType.PICKAXE]: "\u26cf",
      [ToolType.AXE]: "\ud83e\ude93",
      [ToolType.SWORD]: "\u2694\ufe0f",
      [ToolType.FISHING_ROD]: "\ud83c\udfa3",
    };
    const toolNames: Record<ToolType, string> = {
      [ToolType.HAND]: "Hand",
      [ToolType.PICKAXE]: "Pick",
      [ToolType.AXE]: "Axe",
      [ToolType.SWORD]: "Sword",
      [ToolType.FISHING_ROD]: "Rod",
    };

    for (const tool of ALL_TOOLS) {
      const slot = document.createElement("div");
      Object.assign(slot.style, {
        width: "40px",
        height: "36px",
        background: "rgba(60,60,60,0.8)",
        border: "2px solid transparent",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: "16px",
      });

      const icon = document.createElement("span");
      icon.textContent = toolIcons[tool];
      slot.appendChild(icon);

      const name = document.createElement("span");
      name.textContent = toolNames[tool];
      Object.assign(name.style, {
        color: "white",
        fontSize: "8px",
        fontFamily: "monospace",
      });
      slot.appendChild(name);

      slot.addEventListener("click", () => {
        this.onToolSelect?.(tool);
      });

      this.toolBar.appendChild(slot);
      this.toolSlots.push(slot);
    }

    // Block selector bar
    this.blockBar = document.createElement("div");
    Object.assign(this.blockBar.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "4px",
      padding: "6px",
      background: "rgba(0,0,0,0.5)",
      borderRadius: "6px",
      zIndex: "100",
    });
    document.body.appendChild(this.blockBar);

    for (let i = 0; i < PLACEABLE_BLOCKS.length; i++) {
      const slot = document.createElement("div");
      const def = getBlockDef(PLACEABLE_BLOCKS[i]!);
      Object.assign(slot.style, {
        width: "40px",
        height: "40px",
        background: def?.color.side ?? "#333",
        border: "2px solid transparent",
        borderRadius: "4px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
      });

      const label = document.createElement("span");
      label.textContent = `${i + 1}`;
      Object.assign(label.style, {
        color: "white",
        fontSize: "10px",
        fontFamily: "monospace",
        textShadow: "1px 1px 1px black",
        position: "absolute",
        bottom: "2px",
        right: "3px",
      });
      slot.appendChild(label);

      slot.addEventListener("click", () => {
        this.onBlockSelect?.(i);
      });

      this.blockBar.appendChild(slot);
    }

    // Audio indicator (shows when audio is active)
    this.audioIndicator = document.createElement("div");
    Object.assign(this.audioIndicator.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "12px",
      background: "rgba(0,0,0,0.4)",
      padding: "4px 8px",
      borderRadius: "4px",
      zIndex: "100",
      pointerEvents: "none",
    });
    this.audioIndicator.textContent = "";
    document.body.appendChild(this.audioIndicator);

    // Debug overlay
    this.debugEl = document.createElement("div");
    Object.assign(this.debugEl.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "13px",
      lineHeight: "1.6",
      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
      pointerEvents: "none",
      zIndex: "100",
      display: "none",
    });
    document.body.appendChild(this.debugEl);

    document.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.showDebug = !this.showDebug;
        this.debugEl.style.display = this.showDebug ? "block" : "none";
      }
    });

    // Click-to-play overlay
    const overlay = document.createElement("div");
    overlay.id = "play-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.7)",
      color: "white",
      fontFamily: "sans-serif",
      fontSize: "28px",
      cursor: "pointer",
      zIndex: "200",
    });
    overlay.innerHTML = `
      <div style="margin-bottom:20px;font-weight:bold;font-size:36px">MINR</div>
      <div style="font-size:18px;margin-bottom:20px">Click to play</div>
      <div style="font-size:13px;opacity:0.8;line-height:2.2;text-align:left;max-width:420px">
        <b>MOVE:</b> WASD / Arrows &nbsp;&nbsp; <b>JUMP:</b> Space<br>
        <b>CAMERA:</b> V to toggle 1st/3rd person<br>
        <b style="color:#66ff66">BUILD:</b> B or Right-click places blocks &nbsp; 1-6 picks type<br>
        <b>BREAK:</b> Left-click breaks blocks or attacks<br>
        <b>TOOLS:</b> Tab / Q to cycle (Hand, Pick, Axe, Sword, Rod)<br>
        <b>FISH:</b> F = equip rod &nbsp; C or Left-click = cast &nbsp; Hold click to reel<br>
        <b>RESET:</b> R to teleport home<br>
        <b>MUSIC:</b> M &nbsp;&nbsp; <b>DEBUG:</b> F3
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", () => {
      overlay.style.display = "none";
      this.onPlay?.();
    });

    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement) {
        overlay.style.display = "flex";
      }
    });
  }

  onBlockSelect?: (index: number) => void;
  onToolSelect?: (tool: ToolType) => void;
  onPlay?: () => void;

  setTool(tool: ToolType): void {
    this.currentTool = tool;
  }

  setAudioState(state: string): void {
    this.audioIndicator.textContent = state;
  }

  debugInfo = { animals: 0, fish: 0, zombies: 0 };
  dayTime = 0.25;

  update(player: Player, dt: number): void {
    // Health bar
    const healthPct = (player.health / player.maxHealth) * 100;
    this.healthFill.style.width = healthPct + "%";
    if (healthPct > 50) {
      this.healthFill.style.background = "linear-gradient(90deg, #22aa22, #44ff44)";
    } else if (healthPct > 25) {
      this.healthFill.style.background = "linear-gradient(90deg, #aaaa22, #ffff44)";
    } else {
      this.healthFill.style.background = "linear-gradient(90deg, #cc2222, #ff4444)";
    }
    this.healthText.textContent = `${player.health} / ${player.maxHealth}`;

    // Day/night
    const isNight = this.dayTime < 0.25 || this.dayTime > 0.75;
    const hour = Math.floor(((this.dayTime + 0.25) % 1) * 24);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    this.dayIndicator.textContent = `${isNight ? "\ud83c\udf19" : "\u2600\ufe0f"} ${h12}:00 ${ampm}`;

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // Block selector highlight
    const slots = this.blockBar.children;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i] as HTMLElement;
      slot.style.border = i === player.selectedBlockIndex
        ? "2px solid white"
        : "2px solid transparent";
    }

    // Tool selector highlight
    for (let i = 0; i < this.toolSlots.length; i++) {
      const slot = this.toolSlots[i]!;
      slot.style.border = ALL_TOOLS[i] === this.currentTool
        ? "2px solid white"
        : "2px solid transparent";
    }

    if (this.showDebug) {
      const p = player.position;
      const toolName = getToolDef(this.currentTool).name;
      this.debugEl.innerHTML = [
        `Minr`,
        `FPS: ${this.fpsDisplay}`,
        `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`,
        `Chunk: ${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}`,
        `Tool: ${toolName}`,
        `Animals: ${this.debugInfo.animals} Fish: ${this.debugInfo.fish} Zombies: ${this.debugInfo.zombies}`,
      ].join("<br>");
    }
  }
}
