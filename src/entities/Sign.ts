import * as THREE from "three";

/**
 * Wooden sign placed near water with text.
 * Mario-style info sign with blocky post and board.
 */
export class Sign {
  group: THREE.Group;
  position: THREE.Vector3;
  private textCanvas: HTMLCanvasElement;

  constructor(x: number, y: number, z: number, lines: string[], faceYaw = 0) {
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });

    // Post
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), woodMat);
    post.position.y = 0.5;
    this.group.add(post);

    // Sign board
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.08), darkWood);
    board.position.y = 1.2;
    this.group.add(board);

    // Board frame (lighter edges)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.1), woodMat);
    frameTop.position.y = 1.55;
    this.group.add(frameTop);
    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.1), woodMat);
    frameBot.position.y = 0.85;
    this.group.add(frameBot);
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.1), woodMat);
    frameLeft.position.set(-0.62, 1.2, 0);
    this.group.add(frameLeft);
    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.1), woodMat);
    frameRight.position.set(0.62, 1.2, 0);
    this.group.add(frameRight);

    // Text on the sign (canvas texture)
    this.textCanvas = document.createElement("canvas");
    this.textCanvas.width = 256;
    this.textCanvas.height = 128;
    const ctx = this.textCanvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#3a1a08";
    ctx.fillRect(0, 0, 256, 128);

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";

    const startY = 20 + (128 - lines.length * 24) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, 128, startY + i * 24);
    }

    const texture = new THREE.CanvasTexture(this.textCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    const textMat = new THREE.MeshBasicMaterial({ map: texture });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), textMat);
    textPlane.position.set(0, 1.2, 0.05);
    this.group.add(textPlane);

    // Also add text on the back
    const textPlaneBack = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), textMat);
    textPlaneBack.position.set(0, 1.2, -0.05);
    textPlaneBack.rotation.y = Math.PI;
    this.group.add(textPlaneBack);

    // Position and face direction
    this.group.position.set(x, y, z);
    this.group.rotation.y = faceYaw;
  }
}
