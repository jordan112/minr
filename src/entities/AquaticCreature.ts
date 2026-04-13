import * as THREE from "three";
import { World } from "../world/World";
import { BlockId } from "../world/BlockType";

export type AquaticType = "fish" | "shark" | "squid";

export class AquaticCreature {
  group: THREE.Group;
  type: AquaticType;
  position: THREE.Vector3;
  isDead = false;
  health: number;

  private world: World;
  private velocity = new THREE.Vector3();
  private targetYaw = 0;
  private currentYaw = 0;
  private swimTime = 0;
  private dirChangeTimer = 0;
  private jumpTimer = 0;
  private isJumping = false;
  private tailGroup: THREE.Group | null = null;
  private tentacles: THREE.Group[] = [];

  constructor(type: AquaticType, world: World, x: number, y: number, z: number) {
    this.type = type;
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.currentYaw;
    this.health = type === "shark" ? 20 : type === "squid" ? 30 : 5;

    this.buildModel();
    this.pickNewDirection();
  }

  private buildModel(): void {
    switch (this.type) {
      case "fish": this.buildFish(); break;
      case "shark": this.buildShark(); break;
      case "squid": this.buildSquid(); break;
    }
  }

  private buildFish(): void {
    // Small colorful fish
    const colors = [0xff6633, 0x33aaff, 0xffcc00, 0x33ff66, 0xff33aa];
    const color = colors[Math.floor(Math.random() * colors.length)]!;
    const mat = new THREE.MeshLambertMaterial({ color });

    // Body - small oval
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.3), mat);
    this.group.add(body);

    // Tail
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.z = -0.18;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.1), mat);
    this.tailGroup.add(tail);
    this.group.add(this.tailGroup);

    // Eye
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), eyeMat);
    leftEye.position.set(-0.08, 0.02, 0.1);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), eyeMat);
    rightEye.position.set(0.08, 0.02, 0.1);
    this.group.add(rightEye);

    // Dorsal fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.1), mat);
    fin.position.set(0, 0.1, 0);
    this.group.add(fin);
  }

  private buildShark(): void {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
    const bellyMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });

    // Body - torpedo shape
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 1.4), bodyMat);
    this.group.add(body);

    // Belly
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 1.3), bellyMat);
    belly.position.y = -0.15;
    this.group.add(belly);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), bodyMat);
    snout.position.set(0, -0.05, 0.8);
    this.group.add(snout);

    // Dorsal fin (iconic)
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.3), bodyMat);
    dorsalFin.position.set(0, 0.3, 0);
    dorsalFin.rotation.x = -0.15;
    this.group.add(dorsalFin);

    // Tail
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.z = -0.8;
    const tailTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.2), bodyMat);
    tailTop.position.y = 0.1;
    tailTop.rotation.x = 0.3;
    this.tailGroup.add(tailTop);
    const tailBot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.15), bodyMat);
    tailBot.position.y = -0.08;
    tailBot.rotation.x = -0.2;
    this.tailGroup.add(tailBot);
    this.group.add(this.tailGroup);

    // Side fins
    const finMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
    const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.2), finMat);
    leftFin.position.set(-0.35, -0.1, 0.2);
    leftFin.rotation.z = -0.3;
    this.group.add(leftFin);
    const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.2), finMat);
    rightFin.position.set(0.35, -0.1, 0.2);
    rightFin.rotation.z = 0.3;
    this.group.add(rightFin);

    // Eyes
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
    leftEye.position.set(-0.22, 0.05, 0.55);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
    rightEye.position.set(0.22, 0.05, 0.55);
    this.group.add(rightEye);

    // Teeth
    const teethMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), teethMat);
      tooth.position.set(-0.1 + i * 0.07, -0.12, 0.94);
      this.group.add(tooth);
    }
  }

  private buildSquid(): void {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x663366 });
    const tentacleMat = new THREE.MeshLambertMaterial({ color: 0x884488 });

    // Mantle (head/body)
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), bodyMat);
    this.group.add(mantle);

    // Head dome
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), bodyMat);
    dome.position.set(0, 0.1, -0.7);
    this.group.add(dome);

    // Eyes (large)
    const eyeWhite = new THREE.MeshLambertMaterial({ color: 0xffffcc });
    const eyePupil = new THREE.MeshLambertMaterial({ color: 0x220022 });
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.08), eyeWhite);
      white.position.set(side * 0.35, 0.1, 0.4);
      this.group.add(white);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.04), eyePupil);
      pupil.position.set(side * 0.35, 0.08, 0.44);
      this.group.add(pupil);
    }

    // Tentacles (8)
    for (let i = 0; i < 8; i++) {
      const tentGroup = new THREE.Group();
      const angle = (i / 8) * Math.PI * 2;
      const radius = 0.25;
      tentGroup.position.set(
        Math.cos(angle) * radius,
        -0.2,
        0.6 + Math.sin(angle) * 0.1
      );

      // 3 segments per tentacle
      for (let s = 0; s < 3; s++) {
        const width = 0.1 - s * 0.02;
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(width, width, 0.35),
          tentacleMat
        );
        seg.position.z = s * 0.3;
        tentGroup.add(seg);
      }

      this.tentacles.push(tentGroup);
      this.group.add(tentGroup);
    }

    // Fin flaps on mantle
    const finMat = new THREE.MeshLambertMaterial({ color: 0x774477 });
    const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.5), finMat);
    leftFin.position.set(-0.5, 0.1, -0.3);
    this.group.add(leftFin);
    const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.5), finMat);
    rightFin.position.set(0.5, 0.1, -0.3);
    this.group.add(rightFin);
  }

  private pickNewDirection(): void {
    this.targetYaw = Math.random() * Math.PI * 2;
    this.dirChangeTimer = 3 + Math.random() * 5;

    // Fish occasionally jump
    if (this.type === "fish") {
      this.jumpTimer = 5 + Math.random() * 15;
    }
  }

  get radius(): number {
    switch (this.type) {
      case "fish": return 0.3;
      case "shark": return 0.8;
      case "squid": return 1.0;
    }
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.isDead = true;
      // Float to surface
      this.velocity.y = 2;
    }
    // Flash red
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
        obj.material.emissive.setHex(0xff0000);
        setTimeout(() => {
          if (obj.material instanceof THREE.MeshLambertMaterial) {
            obj.material.emissive.setHex(0x000000);
          }
        }, 200);
      }
    });
  }

  update(dt: number): void {
    if (this.isDead) {
      // Float up and fade
      this.velocity.y = 1;
      this.position.y += this.velocity.y * dt;
      this.group.position.copy(this.position);
      this.group.rotation.z += dt * 2;
      if (this.position.y > 100) {
        this.group.visible = false;
      }
      return;
    }

    this.swimTime += dt;
    this.dirChangeTimer -= dt;

    if (this.dirChangeTimer <= 0) {
      this.pickNewDirection();
    }

    // Smooth yaw
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.currentYaw += yawDiff * Math.min(1, dt * 2);

    // Swimming speed varies by type
    const speed = this.type === "shark" ? 2.5 : this.type === "squid" ? 1.5 : 1.8;

    // Check if currently in water
    const blockAtPos = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z)
    );
    const inWater = blockAtPos === BlockId.WATER;

    // Fish jumping
    if (this.type === "fish" && !this.isJumping) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0 && inWater) {
        this.isJumping = true;
        this.velocity.y = 5 + Math.random() * 3;
        this.jumpTimer = 8 + Math.random() * 20;
      }
    }

    if (this.isJumping) {
      // Gravity while jumping
      this.velocity.y -= 12 * dt;
      this.position.y += this.velocity.y * dt;

      // Re-enter water
      const nowBlock = this.world.getBlock(
        Math.floor(this.position.x),
        Math.floor(this.position.y),
        Math.floor(this.position.z)
      );
      if (nowBlock === BlockId.WATER && this.velocity.y < 0) {
        this.isJumping = false;
        this.velocity.y = 0;
      }
    } else if (inWater) {
      // Swim forward
      this.velocity.x = Math.sin(this.currentYaw) * speed;
      this.velocity.z = Math.cos(this.currentYaw) * speed;

      // Bob up and down gently
      const targetY = this.findWaterSurfaceY() - this.getSwimDepth();
      this.velocity.y = (targetY - this.position.y) * 2;

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y += this.velocity.y * dt;
    } else {
      // Not in water — try to find water
      this.velocity.y -= 8 * dt;
      this.position.y += this.velocity.y * dt;
    }

    // Turn around if hitting solid block
    const aheadX = this.position.x + Math.sin(this.currentYaw) * 1.5;
    const aheadZ = this.position.z + Math.cos(this.currentYaw) * 1.5;
    const aheadBlock = this.world.getBlock(
      Math.floor(aheadX),
      Math.floor(this.position.y),
      Math.floor(aheadZ)
    );
    if (aheadBlock !== BlockId.WATER && aheadBlock !== BlockId.AIR) {
      this.targetYaw = this.currentYaw + Math.PI;
      this.dirChangeTimer = 2;
    }

    // Animations
    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;

    // Tail wag
    if (this.tailGroup) {
      this.tailGroup.rotation.y = Math.sin(this.swimTime * 6) * 0.4;
    }

    // Body tilt during turns
    this.group.rotation.z = -yawDiff * 0.3;

    // Fish: body wobble
    if (this.type === "fish") {
      this.group.rotation.x = Math.sin(this.swimTime * 3) * 0.1;
      if (this.isJumping) {
        // Arc rotation during jump
        this.group.rotation.x = -this.velocity.y * 0.1;
      }
    }

    // Squid: tentacle animation
    for (let i = 0; i < this.tentacles.length; i++) {
      const t = this.tentacles[i]!;
      const phase = (i / this.tentacles.length) * Math.PI * 2;
      t.rotation.x = Math.sin(this.swimTime * 2 + phase) * 0.3;
      t.rotation.y = Math.sin(this.swimTime * 1.5 + phase) * 0.2;
    }

    // Shark: subtle side-to-side body sway
    if (this.type === "shark") {
      this.group.rotation.y = this.currentYaw + Math.sin(this.swimTime * 3) * 0.05;
    }
  }

  private findWaterSurfaceY(): number {
    const bx = Math.floor(this.position.x);
    const bz = Math.floor(this.position.z);
    for (let y = Math.floor(this.position.y) + 5; y >= 0; y--) {
      if (this.world.getBlock(bx, y, bz) === BlockId.WATER &&
          this.world.getBlock(bx, y + 1, bz) !== BlockId.WATER) {
        return y + 1;
      }
    }
    return this.position.y;
  }

  private getSwimDepth(): number {
    switch (this.type) {
      case "fish": return 0.3 + Math.random() * 0.3;
      case "shark": return 0.5;
      case "squid": return 1.5;
    }
  }
}
