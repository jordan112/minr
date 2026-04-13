/**
 * Fishing mini-game overlay.
 * Cast into water, wait for a bite, then play a timing game to reel in.
 *
 * States:
 * - idle: not fishing
 * - casting: line is flying out
 * - waiting: bobber in water, waiting for fish
 * - bite: fish is biting! player must click
 * - reeling: timing game — keep the marker in the green zone
 * - caught: success!
 * - lost: fish got away
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
  private fishIcon: HTMLDivElement;

  state: FishingState = "idle";
  private waitTimer = 0;
  private biteTimer = 0;
  private reelingTime = 0;
  private markerPos = 50;      // 0-100
  private markerVel = 0;
  private greenZonePos = 40;   // 0-100
  private greenZoneSize = 25;  // width in %
  private greenZoneDir = 1;
  private fishProgress = 0;    // 0-100, reach 100 to catch
  private fishName = "";
  private holdingClick = false;

  onCatch?: (fishName: string) => void;

  constructor() {
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
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
      fontSize: "20px",
      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
      marginBottom: "20px",
      textAlign: "center",
    });
    this.overlay.appendChild(this.statusText);

    // Fish icon (shows during reeling)
    this.fishIcon = document.createElement("div");
    Object.assign(this.fishIcon.style, {
      fontSize: "32px",
      marginBottom: "10px",
    });
    this.overlay.appendChild(this.fishIcon);

    // Reeling bar
    this.barContainer = document.createElement("div");
    Object.assign(this.barContainer.style, {
      width: "300px",
      height: "30px",
      background: "rgba(0,0,0,0.6)",
      borderRadius: "15px",
      position: "relative",
      overflow: "hidden",
      border: "2px solid rgba(255,255,255,0.3)",
    });
    this.overlay.appendChild(this.barContainer);

    // Green zone (target area)
    this.greenZone = document.createElement("div");
    Object.assign(this.greenZone.style, {
      position: "absolute",
      top: "0",
      height: "100%",
      background: "rgba(0,200,0,0.4)",
      borderRadius: "15px",
    });
    this.barContainer.appendChild(this.greenZone);

    // Marker (player controls this)
    this.marker = document.createElement("div");
    Object.assign(this.marker.style, {
      position: "absolute",
      top: "2px",
      width: "6px",
      height: "26px",
      background: "white",
      borderRadius: "3px",
      boxShadow: "0 0 6px white",
    });
    this.barContainer.appendChild(this.marker);

    // Progress bar (below the reeling bar)
    const progressContainer = document.createElement("div");
    Object.assign(progressContainer.style, {
      width: "300px",
      height: "8px",
      background: "rgba(0,0,0,0.4)",
      borderRadius: "4px",
      marginTop: "8px",
      overflow: "hidden",
    });
    this.overlay.appendChild(progressContainer);

    this.progressBar = document.createElement("div");
    Object.assign(this.progressBar.style, {
      width: "0%",
      height: "100%",
      background: "linear-gradient(90deg, #33aa33, #66ff66)",
      borderRadius: "4px",
      transition: "width 0.1s",
    });
    progressContainer.appendChild(this.progressBar);
  }

  private progressBar: HTMLDivElement;

  startFishing(): void {
    if (this.state !== "idle") return;

    this.state = "casting";
    this.overlay.style.display = "flex";
    this.statusText.textContent = "Casting...";
    this.barContainer.style.display = "none";
    this.fishIcon.textContent = "";

    setTimeout(() => {
      if (this.state === "casting") {
        this.state = "waiting";
        this.waitTimer = 2 + Math.random() * 6;
        this.statusText.textContent = "Waiting for a bite...";
      }
    }, 800);
  }

  cancelFishing(): void {
    this.state = "idle";
    this.overlay.style.display = "none";
    this.holdingClick = false;
  }

  onMouseDown(): void {
    if (this.state === "bite") {
      // Got the bite! Start reeling
      this.state = "reeling";
      this.fishName = FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)]!;
      this.fishIcon.textContent = "\ud83d\udc1f " + this.fishName;
      this.statusText.textContent = "Hold click to reel in!";
      this.barContainer.style.display = "block";
      this.markerPos = 50;
      this.markerVel = 0;
      this.greenZonePos = 30 + Math.random() * 40;
      this.greenZoneSize = 20 + Math.random() * 15;
      this.fishProgress = 0;
      this.reelingTime = 0;
    }
    this.holdingClick = true;
  }

  onMouseUp(): void {
    this.holdingClick = false;
  }

  update(dt: number): void {
    if (this.state === "idle") return;

    if (this.state === "waiting") {
      this.waitTimer -= dt;
      // Bobber animation dots
      const dots = ".".repeat(Math.floor((performance.now() / 500) % 4));
      this.statusText.textContent = "Waiting for a bite" + dots;

      if (this.waitTimer <= 0) {
        this.state = "bite";
        this.biteTimer = 1.5; // Player has 1.5s to react
        this.statusText.textContent = "FISH ON! Click now!";
        this.statusText.style.color = "#ffff00";
        this.fishIcon.textContent = "\ud83d\udc1f!";
      }
    }

    if (this.state === "bite") {
      this.biteTimer -= dt;
      // Flash the text
      this.statusText.style.opacity = Math.floor(performance.now() / 150) % 2 === 0 ? "1" : "0.5";

      if (this.biteTimer <= 0) {
        // Missed!
        this.state = "lost";
        this.statusText.textContent = "The fish got away...";
        this.statusText.style.color = "#ff6666";
        this.statusText.style.opacity = "1";
        this.fishIcon.textContent = "";
        setTimeout(() => this.cancelFishing(), 1500);
      }
    }

    if (this.state === "reeling") {
      this.reelingTime += dt;
      this.statusText.style.color = "white";
      this.statusText.style.opacity = "1";

      // Green zone moves back and forth
      this.greenZonePos += this.greenZoneDir * 30 * dt;
      if (this.greenZonePos > 100 - this.greenZoneSize) {
        this.greenZoneDir = -1;
      } else if (this.greenZonePos < 0) {
        this.greenZoneDir = 1;
      }

      // Make it harder over time — shrink green zone
      this.greenZoneSize = Math.max(12, 25 - this.reelingTime * 1.5);

      // Marker physics — holding click pushes up, gravity pulls down
      if (this.holdingClick) {
        this.markerVel += 200 * dt;
      } else {
        this.markerVel -= 150 * dt;
      }
      this.markerVel *= 0.92; // damping
      this.markerPos += this.markerVel * dt;
      this.markerPos = Math.max(0, Math.min(100, this.markerPos));

      // Check if marker is in green zone
      const inZone = this.markerPos >= this.greenZonePos &&
                     this.markerPos <= this.greenZonePos + this.greenZoneSize;

      if (inZone) {
        this.fishProgress += 25 * dt;
        this.marker.style.background = "#66ff66";
        this.statusText.textContent = "Reeling in " + this.fishName + "!";
      } else {
        this.fishProgress -= 15 * dt;
        this.marker.style.background = "#ff6666";
        this.statusText.textContent = "Keep it in the green!";
      }

      this.fishProgress = Math.max(0, Math.min(100, this.fishProgress));

      // Update visuals
      this.greenZone.style.left = this.greenZonePos + "%";
      this.greenZone.style.width = this.greenZoneSize + "%";
      this.marker.style.left = this.markerPos + "%";
      this.progressBar.style.width = this.fishProgress + "%";

      // Win!
      if (this.fishProgress >= 100) {
        this.state = "caught";
        this.statusText.textContent = "You caught a " + this.fishName + "!";
        this.statusText.style.color = "#66ff66";
        this.fishIcon.textContent = "\ud83c\udf89 \ud83d\udc1f";
        this.barContainer.style.display = "none";
        this.onCatch?.(this.fishName);
        setTimeout(() => this.cancelFishing(), 2500);
      }

      // Lose — if progress drops to 0 after getting some
      if (this.fishProgress <= 0 && this.reelingTime > 3) {
        this.state = "lost";
        this.statusText.textContent = "The " + this.fishName + " got away!";
        this.statusText.style.color = "#ff6666";
        this.fishIcon.textContent = "";
        this.barContainer.style.display = "none";
        setTimeout(() => this.cancelFishing(), 1500);
      }
    }
  }
}
