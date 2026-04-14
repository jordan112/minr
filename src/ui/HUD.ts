import { BlockId, getBlockDef, PLACEABLE_BLOCKS } from "../world/BlockType";
import { Player } from "../player/Player";
import { ToolType, ALL_TOOLS, getToolDef } from "../player/ToolSystem";

export class HUD {
  private debugEl: HTMLDivElement;
  private blockBar: HTMLDivElement;
  private toolBar: HTMLDivElement;
  private heartsContainer: HTMLDivElement;
  private heartsDisplay: HTMLDivElement;
  private statsText: HTMLDivElement;
  private airBubblesDisplay: HTMLDivElement;
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

    // Hearts container
    this.heartsContainer = document.createElement("div");
    Object.assign(this.heartsContainer.style, {
      position: "fixed",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      textAlign: "center",
      zIndex: "100",
      pointerEvents: "none",
    });
    document.body.appendChild(this.heartsContainer);

    this.heartsDisplay = document.createElement("div");
    Object.assign(this.heartsDisplay.style, {
      fontSize: "20px",
      letterSpacing: "2px",
      textShadow: "1px 1px 2px black",
    });
    this.heartsContainer.appendChild(this.heartsDisplay);

    this.statsText = document.createElement("div");
    Object.assign(this.statsText.style, {
      color: "white",
      fontFamily: "monospace",
      fontSize: "12px",
      fontWeight: "bold",
      textShadow: "1px 1px 2px black",
      marginTop: "2px",
    });
    this.heartsContainer.appendChild(this.statsText);

    // Air bubbles display (shown when underwater)
    this.airBubblesDisplay = document.createElement("div");
    Object.assign(this.airBubblesDisplay.style, {
      fontSize: "18px",
      letterSpacing: "2px",
      textShadow: "1px 1px 2px black",
      marginTop: "2px",
      display: "none",
    });
    this.heartsContainer.appendChild(this.airBubblesDisplay);

    // Day/night indicator
    this.dayIndicator = document.createElement("div");
    Object.assign(this.dayIndicator.style, {
      position: "fixed",
      top: "70px",
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
      const baseColor = def?.color.side ?? "#333";

      // Generate a tiny 8x8 textured canvas for the block icon
      const texCanvas = document.createElement("canvas");
      texCanvas.width = 8;
      texCanvas.height = 8;
      const tctx = texCanvas.getContext("2d")!;
      tctx.fillStyle = baseColor;
      tctx.fillRect(0, 0, 8, 8);
      const imgData = tctx.getImageData(0, 0, 8, 8);
      const pixels = imgData.data;
      for (let p = 0; p < pixels.length; p += 4) {
        const noise = Math.floor(Math.random() * 30) - 15;
        pixels[p] = Math.max(0, Math.min(255, pixels[p]! + noise));
        pixels[p + 1] = Math.max(0, Math.min(255, pixels[p + 1]! + noise));
        pixels[p + 2] = Math.max(0, Math.min(255, pixels[p + 2]! + noise));
      }
      tctx.putImageData(imgData, 0, 0);
      const texURL = texCanvas.toDataURL();

      Object.assign(slot.style, {
        width: "40px",
        height: "40px",
        backgroundImage: `url(${texURL})`,
        backgroundSize: "cover",
        imageRendering: "pixelated",
        border: "2px solid transparent",
        borderRadius: "4px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25), inset -1px -1px 0 rgba(0,0,0,0.25)",
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
    // Generate pixelated MINR logo
    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 256;
    logoCanvas.height = 64;
    const lctx = logoCanvas.getContext("2d")!;

    // 5x7 pixel font grids for M, I, N, R
    const letters: number[][][] = [
      // M
      [
        [1,0,0,0,1],
        [1,1,0,1,1],
        [1,0,1,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
      ],
      // I
      [
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [1,1,1,1,1],
      ],
      // N
      [
        [1,0,0,0,1],
        [1,1,0,0,1],
        [1,0,1,0,1],
        [1,0,0,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
      ],
      // R
      [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0],
        [1,0,1,0,0],
        [1,0,0,1,0],
        [1,0,0,0,1],
      ],
    ];

    const pixelSize = 6;
    const letterW = 5 * pixelSize;
    const letterH = 7 * pixelSize;
    const gap = 10;
    const totalW = letters.length * letterW + (letters.length - 1) * gap;
    const offsetX = Math.floor((256 - totalW) / 2);
    const offsetY = Math.floor((64 - letterH) / 2);

    for (let li = 0; li < letters.length; li++) {
      const grid = letters[li]!;
      const lx = offsetX + li * (letterW + gap);
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (!grid[row]![col]) continue;
          const px = lx + col * pixelSize;
          const py = offsetY + row * pixelSize;
          // Gradient: green (#22cc66) to blue (#2266ff) across all letters
          const t = (li * 5 + col) / (letters.length * 5 - 1);
          const r = Math.round(0x22 + (0x22 - 0x22) * t);
          const g = Math.round(0xcc + (0x66 - 0xcc) * t);
          const b = Math.round(0x66 + (0xff - 0x66) * t);
          // Dark outline/shadow (offset +2, +2)
          lctx.fillStyle = "rgba(0,0,0,0.6)";
          lctx.fillRect(px + 2, py + 2, pixelSize, pixelSize);
          // Main pixel
          lctx.fillStyle = `rgb(${r},${g},${b})`;
          lctx.fillRect(px, py, pixelSize, pixelSize);
          // Highlight on top-left of each pixel for a 3D blocky look
          lctx.fillStyle = "rgba(255,255,255,0.2)";
          lctx.fillRect(px, py, pixelSize, 1);
          lctx.fillRect(px, py, 1, pixelSize);
        }
      }
    }

    const logoDataURL = logoCanvas.toDataURL();

    overlay.innerHTML = `
      <img src="${logoDataURL}" style="margin-bottom:20px;image-rendering:pixelated" width="256" height="64" alt="MINR">
      <div style="font-size:18px;margin-bottom:20px">Click to play</div>
      <div style="font-size:13px;opacity:0.8;line-height:2.2;text-align:left;max-width:420px">
        <b>MOVE:</b> WASD / Arrows &nbsp;&nbsp; <b>JUMP:</b> Space<br>
        <b>CAMERA:</b> V to toggle 1st/3rd person<br>
        <b style="color:#66ff66">BUILD:</b> B / E / Right-click places blocks &nbsp; 1-8 picks type<br>
        <b>BREAK:</b> Left-click breaks blocks or attacks<br>
        <b>TOOLS:</b> Tab / Q to cycle (Hand, Pick, Axe, Sword, Rod)<br>
        <b>FISH:</b> F = equip rod &nbsp; C or Left-click = cast &nbsp; Hold click to reel<br>
        <b>BOAT:</b> X to enter/exit boats on water<br>
        <b style="color:#ffaa33">SPAWN:</b> G to spawn creatures<br>
        <b>HEAL:</b> Stay safe 3s to auto-regen &nbsp; <b>PAUSE:</b> P<br>
        <b>SAVE:</b> Ctrl+S (autosaves every 30s) &nbsp; <b>LOAD:</b> L<br>
        <b>RESET:</b> R &nbsp; <b>MUSIC:</b> M &nbsp; <b>DEBUG:</b> F3
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
  fishCaughtCount = 0;
  dayTime = 0.25;
  airBubbles = 10;

  update(player: Player, dt: number): void {
    // Hearts display
    const totalHearts = Math.ceil(player.maxHealth / 2);
    const fullHearts = Math.floor(player.health / 2);
    const emptyHearts = totalHearts - fullHearts;
    this.heartsDisplay.textContent = "\u2764\ufe0f".repeat(fullHearts) + "\ud83d\udda4".repeat(emptyHearts);

    const fishCount = this.fishCaughtCount;
    this.statsText.textContent = `Lv.${player.level}  XP:${player.xp}/${player.level * 20}` + (fishCount > 0 ? `  \ud83d\udc1f${fishCount}` : "");

    // Air bubbles (show only when underwater, i.e. airBubbles < 10)
    if (this.airBubbles < 10) {
      this.airBubblesDisplay.style.display = "block";
      this.airBubblesDisplay.textContent = "\ud83e\udee7".repeat(this.airBubbles);
    } else {
      this.airBubblesDisplay.style.display = "none";
    }

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
