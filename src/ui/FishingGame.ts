/**
 * Fishing mini-game — simplified timing game.
 *
 * 1. Cast into water (F then C, or left-click with rod)
 * 2. Wait for "FISH ON!"
 * 3. A marker bounces back and forth — click when it's in the GREEN zone
 * 4. Hit it 3 times to catch the fish. Miss = fish escapes.
 */
export type FishingState = "idle" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "lost";

const FISH_NAMES = [
  "Tiny Minnow", "Bass", "Trout", "Salmon", "Catfish",
  "Golden Carp", "Pufferfish", "Swordfish", "Rainbow Fish",
  "Ancient Pike", "Glowing Eel", "Crystal Perch",
];

export class FishingGame {
  private overlay: HTMLDivElement;
  private statusText: HTMLDivElement;
  private barContainer: HTMLDivElement;
  private greenZone: HTMLDivElement;
  private marker: HTMLDivElement;
  private hitsDisplay: HTMLDivElement;

  state: FishingState = "idle";
  private waitTimer = 0;
  private biteTimer = 0;
  private markerPos = 0;       // 0-100
  private markerDir = 1;       // 1 = moving right, -1 = left
  private markerSpeed = 80;    // units per second
  private greenZonePos = 35;   // left edge, 0-100
  private greenZoneSize = 30;  // width in %
  private hitsNeeded = 3;
  private hitsSoFar = 0;
  private missesAllowed = 2;
  private missesSoFar = 0;
  private fishName = "";

  onCatch?: (fishName: string) => void;

  constructor() {
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      top: "0", left: "0", right: "0", bottom: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      zIndex: "150",
      pointerEvents: "none",
    });
    document.body.appendChild(this.overlay);

    // Status text
    this.statusText = document.createElement("div");
    Object.assign(this.statusText.style, {
      color: "white",
      fontFamily: "monospace",
      fontSize: "22px",
      fontWeight: "bold",
      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
      marginBottom: "16px",
      textAlign: "center",
    });
    this.overlay.appendChild(this.statusText);

    // Hits display
    this.hitsDisplay = document.createElement("div");
    Object.assign(this.hitsDisplay.style, {
      color: "white",
      fontFamily: "monospace",
      fontSize: "28px",
      marginBottom: "12px",
      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
    });
    this.overlay.appendChild(this.hitsDisplay);

    // Timing bar
    this.barContainer = document.createElement("div");
    Object.assign(this.barContainer.style, {
      width: "350px",
      height: "40px",
      background: "rgba(0,0,0,0.7)",
      borderRadius: "20px",
      position: "relative",
      overflow: "hidden",
      border: "3px solid rgba(255,255,255,0.4)",
      display: "none",
    });
    this.overlay.appendChild(this.barContainer);

    // Green zone
    this.greenZone = document.createElement("div");
    Object.assign(this.greenZone.style, {
      position: "absolute",
      top: "0",
      height: "100%",
      background: "rgba(0,200,0,0.5)",
      borderRadius: "20px",
    });
    this.barContainer.appendChild(this.greenZone);

    // Marker (bouncing line)
    this.marker = document.createElement("div");
    Object.assign(this.marker.style, {
      position: "absolute",
      top: "3px",
      width: "8px",
      height: "34px",
      background: "white",
      borderRadius: "4px",
      boxShadow: "0 0 8px white",
      transition: "none",
    });
    this.barContainer.appendChild(this.marker);

    // Instruction text below bar
    const hint = document.createElement("div");
    Object.assign(hint.style, {
      color: "rgba(255,255,255,0.6)",
      fontFamily: "monospace",
      fontSize: "14px",
      marginTop: "10px",
      textAlign: "center",
    });
    hint.textContent = "Click when the marker is in the GREEN zone!";
    this.overlay.appendChild(hint);
  }

  startFishing(): void {
    if (this.state !== "idle") return;

    this.state = "casting";
    this.overlay.style.display = "flex";
    this.statusText.textContent = "Casting...";
    this.barContainer.style.display = "none";
    this.hitsDisplay.textContent = "";

    setTimeout(() => {
      if (this.state === "casting") {
        this.state = "waiting";
        this.waitTimer = 1.5 + Math.random() * 4;
        this.statusText.textContent = "Waiting for a bite...";
      }
    }, 600);
  }

  cancelFishing(): void {
    this.state = "idle";
    this.overlay.style.display = "none";
  }

  onClick(): void {
    if (this.state === "bite") {
      // Start the timing game
      this.state = "reeling";
      this.fishName = FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)]!;
      this.statusText.textContent = "\ud83d\udc1f " + this.fishName;
      this.barContainer.style.display = "block";
      this.markerPos = 0;
      this.markerDir = 1;
      this.markerSpeed = 70;
      this.hitsSoFar = 0;
      this.missesSoFar = 0;
      this.hitsNeeded = 3;
      this.missesAllowed = 2;
      this.greenZonePos = 30 + Math.random() * 30;
      this.greenZoneSize = 30;
      this.updateHitsDisplay();
      return;
    }

    if (this.state === "reeling") {
      // Check if marker is in the green zone
      const inZone = this.markerPos >= this.greenZonePos &&
                     this.markerPos <= this.greenZonePos + this.greenZoneSize;

      if (inZone) {
        this.hitsSoFar++;
        this.marker.style.background = "#66ff66";
        this.marker.style.boxShadow = "0 0 15px #66ff66";

        if (this.hitsSoFar >= this.hitsNeeded) {
          // CAUGHT!
          this.state = "caught";
          this.statusText.textContent = "\ud83c\udf89 Caught: " + this.fishName + "!";
          this.statusText.style.color = "#66ff66";
          this.barContainer.style.display = "none";
          this.hitsDisplay.textContent = "";
          this.onCatch?.(this.fishName);
          setTimeout(() => this.cancelFishing(), 2000);
          return;
        }

        // Move green zone and speed up slightly
        this.greenZonePos = 15 + Math.random() * 55;
        this.greenZoneSize = Math.max(20, 30 - this.hitsSoFar * 3);
        this.markerSpeed += 10;
      } else {
        this.missesSoFar++;
        this.marker.style.background = "#ff4444";
        this.marker.style.boxShadow = "0 0 15px #ff4444";

        if (this.missesSoFar > this.missesAllowed) {
          // LOST!
          this.state = "lost";
          this.statusText.textContent = "The " + this.fishName + " got away!";
          this.statusText.style.color = "#ff6666";
          this.barContainer.style.display = "none";
          this.hitsDisplay.textContent = "";
          setTimeout(() => this.cancelFishing(), 1500);
          return;
        }
      }

      this.updateHitsDisplay();

      // Reset marker color after flash
      setTimeout(() => {
        if (this.state === "reeling") {
          this.marker.style.background = "white";
          this.marker.style.boxShadow = "0 0 8px white";
        }
      }, 200);
    }
  }

  // Dummy methods for compatibility
  onMouseDown(): void { this.onClick(); }
  onMouseUp(): void {}

  private updateHitsDisplay(): void {
    const filled = "\u2b50".repeat(this.hitsSoFar);
    const empty = "\u2606".repeat(this.hitsNeeded - this.hitsSoFar);
    const misses = "\u274c".repeat(this.missesSoFar);
    this.hitsDisplay.textContent = filled + empty + "  " + misses;
  }

  update(dt: number): void {
    if (this.state === "idle") return;

    if (this.state === "waiting") {
      this.waitTimer -= dt;
      const dots = ".".repeat(Math.floor((performance.now() / 500) % 4));
      this.statusText.textContent = "Waiting for a bite" + dots;

      if (this.waitTimer <= 0) {
        this.state = "bite";
        this.biteTimer = 2.0;
        this.statusText.textContent = "\ud83d\udc1f FISH ON! Click!";
        this.statusText.style.color = "#ffff00";
      }
    }

    if (this.state === "bite") {
      this.biteTimer -= dt;
      this.statusText.style.opacity = Math.floor(performance.now() / 150) % 2 === 0 ? "1" : "0.6";

      if (this.biteTimer <= 0) {
        this.state = "lost";
        this.statusText.textContent = "Too slow! Fish escaped.";
        this.statusText.style.color = "#ff6666";
        this.statusText.style.opacity = "1";
        setTimeout(() => this.cancelFishing(), 1500);
      }
    }

    if (this.state === "reeling") {
      this.statusText.style.color = "white";
      this.statusText.style.opacity = "1";

      // Marker bounces left and right
      this.markerPos += this.markerDir * this.markerSpeed * dt;
      if (this.markerPos >= 100) {
        this.markerPos = 100;
        this.markerDir = -1;
      } else if (this.markerPos <= 0) {
        this.markerPos = 0;
        this.markerDir = 1;
      }

      // Update visuals
      this.marker.style.left = (this.markerPos * 0.97) + "%";
      this.greenZone.style.left = this.greenZonePos + "%";
      this.greenZone.style.width = this.greenZoneSize + "%";
    }
  }
}
