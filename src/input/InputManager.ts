export class InputManager {
  private keys = new Map<string, boolean>();
  private _mouseDX = 0;
  private _mouseDY = 0;
  private _leftClick = false;
  private _rightClick = false;
  isPointerLocked = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    document.addEventListener("keydown", (e) => {
      this.keys.set(e.code, true);
      // Prevent default for game keys
      if (["Space", "KeyW", "KeyA", "KeyS", "KeyD", "Tab"].includes(e.code)) {
        e.preventDefault();
      }
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
      if (e.button === 0) this._leftClick = true;
      if (e.button === 2) this._rightClick = true;
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

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
  get rightClick(): boolean { return this._rightClick; }

  resetFrame(): void {
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._leftClick = false;
    this._rightClick = false;
  }
}
