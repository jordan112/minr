import type { GameModeState } from "./GameMode";

export class BedwarsHUD {
  private container: HTMLDivElement;
  private waveText: HTMLDivElement;
  private bedHealthBar: HTMLDivElement;
  private bedHealthFill: HTMLDivElement;
  private infoText: HTMLDivElement;
  private gameOverOverlay: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      textAlign: "center",
      zIndex: "100",
      pointerEvents: "none",
      display: "none",
    });
    document.body.appendChild(this.container);

    // Wave indicator
    this.waveText = document.createElement("div");
    Object.assign(this.waveText.style, {
      color: "#ff4444",
      fontFamily: "monospace",
      fontSize: "18px",
      fontWeight: "bold",
      textShadow: "2px 2px 4px black",
      marginBottom: "4px",
    });
    this.container.appendChild(this.waveText);

    // Bed health
    this.bedHealthBar = document.createElement("div");
    Object.assign(this.bedHealthBar.style, {
      width: "180px",
      height: "14px",
      background: "rgba(0,0,0,0.6)",
      borderRadius: "7px",
      overflow: "hidden",
      margin: "0 auto 4px",
      border: "1px solid rgba(255,255,255,0.3)",
    });
    this.container.appendChild(this.bedHealthBar);

    this.bedHealthFill = document.createElement("div");
    Object.assign(this.bedHealthFill.style, {
      width: "100%",
      height: "100%",
      background: "linear-gradient(90deg, #cc2222, #ff6644)",
      borderRadius: "7px",
    });
    this.bedHealthBar.appendChild(this.bedHealthFill);

    // Info
    this.infoText = document.createElement("div");
    Object.assign(this.infoText.style, {
      color: "white",
      fontFamily: "monospace",
      fontSize: "12px",
      textShadow: "1px 1px 2px black",
    });
    this.container.appendChild(this.infoText);

    // Game over
    this.gameOverOverlay = document.createElement("div");
    Object.assign(this.gameOverOverlay.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      background: "rgba(0,0,0,0.8)",
      color: "white",
      fontFamily: "monospace",
      zIndex: "300",
    });
    document.body.appendChild(this.gameOverOverlay);
  }

  show(): void { this.container.style.display = "block"; }
  hide(): void { this.container.style.display = "none"; }

  playerPos = { x: 0, z: 0 };

  update(state: GameModeState): void {
    if (state.type !== "bedwars") { this.hide(); return; }
    this.show();

    if (state.betweenWaves) {
      this.waveText.textContent = `\u2694\ufe0f WAVE ${state.wave + 1} in ${Math.ceil(state.waveTimer)}s — BUILD DEFENSES!`;
      this.waveText.style.color = "#44ff44";
    } else {
      this.waveText.textContent = `\u2694\ufe0f WAVE ${state.wave} — ${state.enemiesRemaining} zombies remaining!`;
      this.waveText.style.color = "#ff4444";
    }

    // Distance to bed
    let bedInfo = "";
    if (state.bedPos) {
      const dx = state.bedPos[0] - this.playerPos.x;
      const dz = state.bedPos[2] - this.playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 5) bedInfo = ` (${Math.round(dist)}m away)`;
    }

    const bedPct = (state.bedHealth / state.maxBedHealth) * 100;
    this.bedHealthFill.style.width = bedPct + "%";
    this.infoText.textContent = `\ud83d\udecf\ufe0f Bed: ${state.bedHealth}/${state.maxBedHealth}${bedInfo}  Score: ${state.score}`;

    if (state.gameOver) {
      this.gameOverOverlay.style.display = "flex";
      this.gameOverOverlay.innerHTML = `
        <div style="font-size:36px;margin-bottom:16px;color:#ff4444">GAME OVER</div>
        <div style="font-size:20px;margin-bottom:8px">Your bed was destroyed!</div>
        <div style="font-size:16px;margin-bottom:24px">Waves survived: ${state.wave} &nbsp; Score: ${state.score}</div>
        <div style="font-size:14px;opacity:0.7">Press R to restart</div>
      `;
    } else {
      this.gameOverOverlay.style.display = "none";
    }
  }
}
