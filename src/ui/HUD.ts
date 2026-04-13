import { BlockId, getBlockDef, PLACEABLE_BLOCKS } from "../world/BlockType";
import { Player } from "../player/Player";

export class HUD {
  private debugEl: HTMLDivElement;
  private blockBar: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private showDebug = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fpsDisplay = 0;

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

    // Create block slots
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

      slot.dataset.index = String(i);
      slot.addEventListener("click", () => {
        this.onBlockSelect?.(i);
      });

      this.blockBar.appendChild(slot);
    }

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

    // Toggle debug with F3
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
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      color: "white",
      fontFamily: "sans-serif",
      fontSize: "24px",
      cursor: "pointer",
      zIndex: "200",
    });
    overlay.innerHTML = "Click to play<br><span style='font-size:14px;margin-top:12px;display:block;opacity:0.7'>WASD — move &nbsp; Space — jump &nbsp; V — toggle camera<br>Left click — break &nbsp; Right click — place &nbsp; 1-6 — select block<br>M — toggle music &nbsp; F3 — debug</span>";
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
  onPlay?: () => void;

  update(player: Player, dt: number): void {
    // FPS counter
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // Update block selector highlight
    const slots = this.blockBar.children;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i] as HTMLElement;
      slot.style.border = i === player.selectedBlockIndex
        ? "2px solid white"
        : "2px solid transparent";
    }

    // Debug info
    if (this.showDebug) {
      const p = player.position;
      this.debugEl.innerHTML = [
        `Minr`,
        `FPS: ${this.fpsDisplay}`,
        `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`,
        `Chunk: ${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}`,
      ].join("<br>");
    }
  }
}
