import * as THREE from "three";
import { World } from "../world/World";
import { isSolid, BlockId } from "../world/BlockType";

export type AnimalType = "sheep" | "pig" | "cow";

interface AnimalConfig {
  bodyColor: number;
  bodyW: number;
  bodyH: number;
  bodyD: number;
  headColor: number;
  headSize: number;
  legColor: number;
  detailFn?: (group: THREE.Group) => void;
}

const CONFIGS: Record<AnimalType, AnimalConfig> = {
  sheep: {
    bodyColor: 0xeeeeee,
    bodyW: 0.6, bodyH: 0.5, bodyD: 0.9,
    headColor: 0xcccccc,
    headSize: 0.35,
    legColor: 0x444444,
    detailFn: (group) => {
      // Fluffy wool bumps on top
      const wool = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.15, 0.95),
        new THREE.MeshLambertMaterial({ color: 0xf5f5f5 })
      );
      wool.position.y = 0.7;
      group.add(wool);
    },
  },
  pig: {
    bodyColor: 0xe8a0a0,
    bodyW: 0.55, bodyH: 0.45, bodyD: 0.8,
    headColor: 0xe8a0a0,
    headSize: 0.35,
    legColor: 0xe08080,
    detailFn: (group) => {
      // Snout
      const snout = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xd08080 })
      );
      snout.position.set(0, 0.55, 0.6);
      group.add(snout);
      // Nostrils
      const nostrilMat = new THREE.MeshLambertMaterial({ color: 0x804040 });
      const n1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), nostrilMat);
      n1.position.set(-0.04, 0.54, 0.64);
      group.add(n1);
      const n2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), nostrilMat);
      n2.position.set(0.04, 0.54, 0.64);
      group.add(n2);
    },
  },
  cow: {
    bodyColor: 0x8b6914,
    bodyW: 0.65, bodyH: 0.55, bodyD: 1.0,
    headColor: 0x8b6914,
    headSize: 0.38,
    legColor: 0x6b4914,
    detailFn: (group) => {
      // White patches
      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.25, 0.01),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      patch.position.set(0.15, 0.55, 0.51);
      group.add(patch);
      const patch2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.2, 0.01),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      patch2.position.set(-0.1, 0.6, -0.51);
      group.add(patch2);
      // Horns
      const hornMat = new THREE.MeshLambertMaterial({ color: 0xddddaa });
      const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), hornMat);
      h1.position.set(-0.15, 0.85, 0.45);
      group.add(h1);
      const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), hornMat);
      h2.position.set(0.15, 0.85, 0.45);
      group.add(h2);
    },
  },
};

export class Animal {
  group: THREE.Group;
  type: AnimalType;
  private world: World;
  private velocity = new THREE.Vector3();
  private targetYaw = 0;
  private currentYaw = 0;
  private moveTimer = 0;
  private idleTimer = 0;
  private isMoving = false;
  private walkTime = 0;
  private legs: THREE.Group[] = [];
  position: THREE.Vector3;
  health = 10;
  isDead = false;
  private hurtTimer = 0;
  private deathTimer = 0;
  private originalMaterials: THREE.MeshLambertMaterial[] = [];

  constructor(type: AnimalType, world: World, x: number, y: number, z: number) {
    this.type = type;
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.currentYaw;

    this.buildModel(CONFIGS[type]);
    this.pickNewDirection();
  }

  private buildModel(config: AnimalConfig): void {
    const bodyMat = new THREE.MeshLambertMaterial({ color: config.bodyColor });
    const headMat = new THREE.MeshLambertMaterial({ color: config.headColor });
    const legMat = new THREE.MeshLambertMaterial({ color: config.legColor });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(config.bodyW, config.bodyH, config.bodyD),
      bodyMat
    );
    body.position.y = 0.55;
    this.group.add(body);

    // Head
    const hs = config.headSize;
    const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs, hs), headMat);
    head.position.set(0, 0.6, config.bodyD / 2 + hs / 2 - 0.05);
    this.group.add(head);

    // Eyes
    const eyeSize = 0.06;
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.02), eyeMat);
    leftEye.position.set(-0.08, 0.65, config.bodyD / 2 + hs - 0.06);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.02), eyeMat);
    rightEye.position.set(0.08, 0.65, config.bodyD / 2 + hs - 0.06);
    this.group.add(rightEye);

    // Legs (4)
    const legW = 0.15;
    const legH = 0.35;
    const offsets: [number, number][] = [
      [-config.bodyW / 2 + legW / 2 + 0.02, config.bodyD / 2 - legW / 2 - 0.05],
      [config.bodyW / 2 - legW / 2 - 0.02, config.bodyD / 2 - legW / 2 - 0.05],
      [-config.bodyW / 2 + legW / 2 + 0.02, -config.bodyD / 2 + legW / 2 + 0.05],
      [config.bodyW / 2 - legW / 2 - 0.02, -config.bodyD / 2 + legW / 2 + 0.05],
    ];

    for (const [ox, oz] of offsets) {
      const legGroup = new THREE.Group();
      legGroup.position.set(ox, 0.35, oz);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), legMat);
      legMesh.position.y = -legH / 2;
      legGroup.add(legMesh);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }

    // Type-specific details
    config.detailFn?.(this.group);
  }

  private pickNewDirection(): void {
    this.targetYaw = Math.random() * Math.PI * 2;
    this.moveTimer = 2 + Math.random() * 4;
    this.idleTimer = 1 + Math.random() * 3;
    this.isMoving = Math.random() > 0.4;
  }

  update(dt: number): void {
    // AI: alternate between moving and idling
    if (this.isMoving) {
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) {
        this.isMoving = false;
        this.idleTimer = 2 + Math.random() * 4;
      }
    } else {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.pickNewDirection();
      }
    }

    // Smooth yaw rotation
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.currentYaw += yawDiff * Math.min(1, dt * 3);

    // Movement
    const speed = 1.2;
    if (this.isMoving) {
      this.velocity.x = Math.sin(this.currentYaw) * speed;
      this.velocity.z = Math.cos(this.currentYaw) * speed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Gravity
    this.velocity.y -= 15 * dt;

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Horizontal collision
    if (this.checkCollision(this.position.x, this.position.y, this.position.z)) {
      this.position.x -= this.velocity.x * dt;
      this.position.z -= this.velocity.z * dt;
      this.pickNewDirection(); // Turn around
    }

    // Vertical
    this.position.y += this.velocity.y * dt;
    if (this.velocity.y < 0 && this.checkCollision(this.position.x, this.position.y, this.position.z)) {
      this.position.y = Math.floor(this.position.y) + 1;
      this.velocity.y = 0;
    }

    // Prevent falling below world
    if (this.position.y < 0) {
      this.position.y = 80;
      this.velocity.y = 0;
    }

    // Walk animation
    if (this.isMoving) {
      this.walkTime += dt * 6;
    } else {
      this.walkTime *= 0.9;
    }
    const swing = Math.sin(this.walkTime) * 0.4;
    // Front legs swing opposite to back legs
    if (this.legs[0]) this.legs[0].rotation.x = swing;
    if (this.legs[1]) this.legs[1].rotation.x = swing;
    if (this.legs[2]) this.legs[2].rotation.x = -swing;
    if (this.legs[3]) this.legs[3].rotation.x = -swing;

    // Hurt flash
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      // Flash red
      const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 10) % 2 === 0;
      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
          obj.material.emissive.setHex(flash ? 0xff0000 : 0x000000);
        }
      });
    }

    // Death animation
    if (this.isDead) {
      this.deathTimer += dt;
      this.group.rotation.z = Math.min(this.deathTimer * 3, Math.PI / 2);
      this.group.position.y = this.position.y - this.deathTimer * 0.5;
      if (this.deathTimer > 1.5) {
        // Signal ready for removal
        this.group.visible = false;
      }
      return;
    }

    // Update visual
    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    this.hurtTimer = 0.4;

    // Knockback
    this.velocity.y = 4;

    if (this.health <= 0) {
      this.isDead = true;
      this.deathTimer = 0;
    }
  }

  /** Radius for collision with player */
  get radius(): number {
    return 0.5;
  }

  private checkCollision(x: number, y: number, z: number): boolean {
    const hw = 0.3;
    for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw); bx++) {
      for (let by = Math.floor(y); by <= Math.floor(y + 0.8); by++) {
        for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }
}
