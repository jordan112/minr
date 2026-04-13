import * as THREE from "three";
import { World } from "../world/World";
import { isSolid } from "../world/BlockType";

const SPEECH_BUBBLES = [
  "Welcome to Minr!",
  "Press B to build!",
  "Watch out for zombies\nat night!",
  "Try fishing! Press F\nthen C to cast.",
  "Nice day for mining!",
  "I heard there's lava\nnearby... careful!",
  "Tab to switch tools!",
  "Have you seen\nany sheep?",
  "The squid are huge\nin the deep lakes!",
  "1-8 to pick blocks,\nB to place them!",
  "Zombies hate torches!",
  "Try TNT... boom!",
];

export class Villager {
  group: THREE.Group;
  position: THREE.Vector3;
  private world: World;
  private velocity = new THREE.Vector3();
  private targetYaw = 0;
  private currentYaw = 0;
  private moveTimer = 0;
  private idleTimer = 2;
  private isMoving = false;
  private walkTime = 0;
  private speechBubble: THREE.Sprite | null = null;
  private speechTimer = 0;
  private speechCooldown = 8 + Math.random() * 10;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;

  constructor(world: World, x: number, y: number, z: number) {
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;

    // Robe colors
    const robeColors = [0x8b4513, 0x2e5a2e, 0x4a3080, 0x804020];
    const robeColor = robeColors[Math.floor(Math.random() * robeColors.length)]!;
    const robeMat = new THREE.MeshLambertMaterial({ color: robeColor });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xdbb896 });
    const noseMat = new THREE.MeshLambertMaterial({ color: 0xc9a07a });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const eyeWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Head (larger nose like Minecraft villagers)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.65;
    this.group.add(head);

    // Big nose (iconic villager feature)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.15), noseMat);
    nose.position.set(0, 1.58, 0.32);
    this.group.add(nose);

    // Eyes
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), eyeWhite);
      white.position.set(side * 0.12, 1.7, 0.26);
      this.group.add(white);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), eyeMat);
      pupil.position.set(side * 0.12, 1.69, 0.27);
      this.group.add(pupil);
    }

    // Eyebrows (grumpy look)
    const browMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.02), browMat);
      brow.position.set(side * 0.12, 1.76, 0.26);
      brow.rotation.z = side * -0.2;
      this.group.add(brow);
    }

    // Body (robe)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.35), robeMat);
    body.position.y = 1.0;
    this.group.add(body);

    // Arms (crossed, robe-colored)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.4, 1.35, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), robeMat);
    leftArmMesh.position.y = -0.35;
    this.leftArm.add(leftArmMesh);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.4, 1.35, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), robeMat);
    rightArmMesh.position.y = -0.35;
    this.rightArm.add(rightArmMesh);
    this.group.add(this.rightArm);

    // Legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.13, 0.55, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.27), robeMat);
    leftLegMesh.position.y = -0.275;
    this.leftLeg.add(leftLegMesh);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.13, 0.55, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.27), robeMat);
    rightLegMesh.position.y = -0.275;
    this.rightLeg.add(rightLegMesh);
    this.group.add(this.rightLeg);

    this.pickNewDirection();
  }

  private pickNewDirection(): void {
    this.targetYaw = Math.random() * Math.PI * 2;
    this.moveTimer = 2 + Math.random() * 3;
    this.idleTimer = 2 + Math.random() * 5;
    this.isMoving = Math.random() > 0.5;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // AI
    if (this.isMoving) {
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) { this.isMoving = false; this.idleTimer = 3 + Math.random() * 5; }
    } else {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) this.pickNewDirection();
    }

    // Face player when close
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    if (distToPlayer < 5) {
      this.targetYaw = Math.atan2(dx, dz);
      this.isMoving = false;
    }

    // Smooth yaw
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.currentYaw += yawDiff * Math.min(1, dt * 3);

    // Movement
    if (this.isMoving) {
      const speed = 0.8;
      const vx = Math.sin(this.currentYaw) * speed;
      const vz = Math.cos(this.currentYaw) * speed;
      this.position.x += vx * dt;
      this.position.z += vz * dt;

      // Collision
      if (this.checkCollision()) {
        this.position.x -= vx * dt;
        this.position.z -= vz * dt;
        this.pickNewDirection();
      }
    }

    // Gravity
    this.velocity.y -= 15 * dt;
    this.position.y += this.velocity.y * dt;
    if (this.velocity.y < 0 && this.checkCollision()) {
      this.position.y = Math.floor(this.position.y) + 1;
      this.velocity.y = 0;
    }
    if (this.position.y < 0) { this.position.y = 80; this.velocity.y = 0; }

    // Walk animation
    if (this.isMoving) { this.walkTime += dt * 5; } else { this.walkTime *= 0.85; }
    const swing = Math.sin(this.walkTime) * 0.4;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.5;
    this.rightArm.rotation.x = swing * 0.5;

    // Speech bubble
    this.speechCooldown -= dt;
    if (this.speechCooldown <= 0 && distToPlayer < 8) {
      this.showSpeech();
      this.speechCooldown = 10 + Math.random() * 15;
    }
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0 && this.speechBubble) {
        this.group.remove(this.speechBubble);
        this.speechBubble = null;
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
  }

  private showSpeech(): void {
    if (this.speechBubble) {
      this.group.remove(this.speechBubble);
    }

    const text = SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)]!;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    // Rounded bubble
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 10);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#222";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, 128, 24 + i * 18);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.speechBubble = new THREE.Sprite(mat);
    this.speechBubble.scale.set(2, 0.5, 1);
    this.speechBubble.position.y = 2.3;
    this.group.add(this.speechBubble);
    this.speechTimer = 4;
  }

  private checkCollision(): boolean {
    const hw = 0.25;
    for (let bx = Math.floor(this.position.x - hw); bx <= Math.floor(this.position.x + hw); bx++) {
      for (let by = Math.floor(this.position.y); by <= Math.floor(this.position.y + 1.8); by++) {
        for (let bz = Math.floor(this.position.z - hw); bz <= Math.floor(this.position.z + hw); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  get radius(): number { return 0.5; }
}
