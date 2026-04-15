export class InputManager {
  private keys = new Map<string, boolean>();
  private _mouseDX = 0;
  private _mouseDY = 0;
  private _leftClick = false;
  private _rightClick = false;
  private _leftHeld = false;
  private _placeClick = false;
  private _scrollDelta = 0;
  isPointerLocked = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    document.addEventListener("keydown", (e) => {
      this.keys.set(e.code, true);
      // Prevent default for game keys
      if (["Space", "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "KeyB" || e.code === "KeyE") this._placeClick = true;
    });

    document.addEventListener("keyup", (e) => {
      this.keys.set(e.code, false);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isPointerLocked) return;
      this._mouseDX += e.movementX;
      this._mouseDY += e.movementY;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) { this._leftClick = true; this._leftHeld = true; }
      if (e.button === 2) this._rightClick = true;
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) this._leftHeld = false;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Scroll wheel for block selection
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._scrollDelta += e.deltaY > 0 ? 1 : -1;
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.get(code) ?? false;
  }

  get mouseDX(): number { return this._mouseDX; }
  get mouseDY(): number { return this._mouseDY; }
  get leftClick(): boolean { return this._leftClick; }
  get leftHeld(): boolean { return this._leftHeld; }
  get rightClick(): boolean { return this._rightClick; }
  get placeClick(): boolean { return this._placeClick; }
  get scrollDelta(): number { return this._scrollDelta; }

  resetFrame(): void {
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._leftClick = false;
    this._rightClick = false;
    this._placeClick = false;
    this._scrollDelta = 0;
  }
}
