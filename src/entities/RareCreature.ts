import * as THREE from "three";
import { World } from "../world/World";
import { isSolid, BlockId } from "../world/BlockType";

export type RareType = "trex" | "bigfoot" | "dragon" | "unicorn" | "yeti";

interface CreatureConfig {
  health: number;
  speed: number;
  hostile: boolean;
  damage: number;
  scale: number;
}

const CONFIGS: Record<RareType, CreatureConfig> = {
  trex:    { health: 50, speed: 3.5, hostile: true, damage: 8, scale: 2.5 },
  bigfoot: { health: 30, speed: 2.0, hostile: false, damage: 5, scale: 2.0 },
  dragon:  { health: 60, speed: 2.5, hostile: true, damage: 10, scale: 2.0 },
  unicorn: { health: 25, speed: 3.0, hostile: false, damage: 0, scale: 1.5 },
  yeti:    { health: 40, speed: 2.2, hostile: true, damage: 6, scale: 2.2 },
};

export const ALL_RARE_TYPES: RareType[] = ["trex", "bigfoot", "dragon", "unicorn", "yeti"];

export class RareCreature {
  group: THREE.Group;
  type: RareType;
  position: THREE.Vector3;
  health: number;
  isDead = false;
  private world: World;
  private config: CreatureConfig;
  private velocity = new THREE.Vector3();
  private currentYaw = 0;
  private walkTime = 0;
  private hurtTimer = 0;
  private deathTimer = 0;
  private legs: THREE.Group[] = [];
  attackCooldown = 0;

  constructor(type: RareType, world: World, x: number, y: number, z: number) {
    this.type = type;
    this.world = world;
    this.config = CONFIGS[type];
    this.health = this.config.health;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;

    this.buildModel();
  }

  private buildModel(): void {
    switch (this.type) {
      case "trex": this.buildTRex(); break;
      case "bigfoot": this.buildBigfoot(); break;
      case "dragon": this.buildDragon(); break;
      case "unicorn": this.buildUnicorn(); break;
      case "yeti": this.buildYeti(); break;
    }
    this.group.scale.setScalar(this.config.scale);
  }

  private buildTRex(): void {
    const skin = new THREE.MeshLambertMaterial({ color: 0x4a6a2a });
    const belly = new THREE.MeshLambertMaterial({ color: 0x6a8a4a });
    const eye = new THREE.MeshLambertMaterial({ color: 0xff4400 });
    const tooth = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.4), skin);
    body.position.y = 1.0;
    this.group.add(body);

    // Head (big!)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.7), skin);
    head.position.set(0, 1.3, 0.9);
    this.group.add(head);

    // Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.65), belly);
    jaw.position.set(0, 1.05, 0.9);
    this.group.add(jaw);

    // Teeth
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), tooth);
      t.position.set(-0.15 + i * 0.07, 1.12, 1.2);
      this.group.add(t);
    }

    // Eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), eye);
      e.position.set(s * 0.22, 1.4, 1.05);
      this.group.add(e);
    }

    // Tiny arms (iconic!)
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), skin);
      arm.position.set(s * 0.4, 0.85, 0.5);
      this.group.add(arm);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 1.0), skin);
    tail.position.set(0, 0.9, -0.8);
    this.group.add(tail);
    const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), skin);
    tailTip.position.set(0, 0.85, -1.5);
    this.group.add(tailTip);

    // Legs
    for (const s of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(s * 0.25, 0.5, 0.1);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.25), skin);
      leg.position.y = -0.25;
      legGroup.add(leg);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  private buildBigfoot(): void {
    const fur = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
    const darkFur = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const eye = new THREE.MeshLambertMaterial({ color: 0xffcc00 });

    // Body (tall, bulky)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), fur);
    body.position.y = 1.2;
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), fur);
    head.position.y = 1.95;
    this.group.add(head);

    // Face
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.05), darkFur);
    face.position.set(0, 1.88, 0.25);
    this.group.add(face);

    // Glowing eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), eye);
      e.position.set(s * 0.1, 1.95, 0.27);
      this.group.add(e);
    }

    // Arms (long)
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), fur);
      arm.position.set(s * 0.45, 1.0, 0);
      this.group.add(arm);
    }

    // Legs
    for (const s of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(s * 0.2, 0.5, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.3), darkFur);
      leg.position.y = -0.25;
      legGroup.add(leg);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  private buildDragon(): void {
    const scale = new THREE.MeshLambertMaterial({ color: 0x880022 });
    const wing = new THREE.MeshLambertMaterial({ color: 0xaa3344, side: THREE.DoubleSide });
    const eye = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const fire = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.2), scale);
    body.position.y = 0.8;
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), scale);
    head.position.set(0, 1.0, 0.75);
    this.group.add(head);

    // Horns
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      horn.position.set(s * 0.15, 1.25, 0.65);
      horn.rotation.x = -0.3;
      this.group.add(horn);
    }

    // Eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), eye);
      e.position.set(s * 0.15, 1.05, 0.98);
      this.group.add(e);
    }

    // Fire breath particles (just a glow block)
    const fireBreath = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), fire);
    fireBreath.position.set(0, 0.95, 1.1);
    this.group.add(fireBreath);

    // Wings
    for (const s of [-1, 1]) {
      const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), wing);
      wingMesh.position.set(s * 0.65, 1.0, 0.1);
      wingMesh.rotation.z = s * -0.3;
      this.group.add(wingMesh);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.8), scale);
    tail.position.set(0, 0.75, -0.8);
    this.group.add(tail);

    // Legs
    for (const s of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(s * 0.2, 0.4, 0.2);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.18), scale);
      leg.position.y = -0.2;
      legGroup.add(leg);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  private buildUnicorn(): void {
    const body = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mane = new THREE.MeshLambertMaterial({ color: 0xff88cc });
    const horn = new THREE.MeshLambertMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.3 });
    const eye = new THREE.MeshLambertMaterial({ color: 0x4444ff });

    // Body
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), body);
    bodyMesh.position.y = 0.7;
    this.group.add(bodyMesh);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.35), body);
    head.position.set(0, 1.0, 0.55);
    this.group.add(head);

    // Horn (golden, glowing)
    const hornMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), horn);
    hornMesh.position.set(0, 1.35, 0.6);
    hornMesh.rotation.x = -0.2;
    this.group.add(hornMesh);

    // Mane
    const maneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.5), mane);
    maneMesh.position.set(0, 1.0, 0.2);
    this.group.add(maneMesh);

    // Tail
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.15), mane);
    tailMesh.position.set(0, 0.7, -0.55);
    tailMesh.rotation.x = 0.3;
    this.group.add(tailMesh);

    // Eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), eye);
      e.position.set(s * 0.12, 1.05, 0.72);
      this.group.add(e);
    }

    // Legs
    for (const [ox, oz] of [[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]] as [number, number][]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(ox, 0.35, oz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), body);
      leg.position.y = -0.175;
      legGroup.add(leg);
      // Golden hooves
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.13), horn);
      hoof.position.y = -0.37;
      legGroup.add(hoof);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  private buildYeti(): void {
    const fur = new THREE.MeshLambertMaterial({ color: 0xddddee });
    const darkFur = new THREE.MeshLambertMaterial({ color: 0xaaaacc });
    const eye = new THREE.MeshLambertMaterial({ color: 0x66ccff });

    // Body (big and bulky)
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.55), fur);
    bodyMesh.position.y = 1.2;
    this.group.add(bodyMesh);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), fur);
    head.position.y = 1.95;
    this.group.add(head);

    // Face
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.05), darkFur);
    face.position.set(0, 1.85, 0.27);
    this.group.add(face);

    // Blue eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), eye);
      e.position.set(s * 0.12, 1.92, 0.28);
      this.group.add(e);
    }

    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), new THREE.MeshLambertMaterial({ color: 0x333344 }));
    mouth.position.set(0, 1.78, 0.28);
    this.group.add(mouth);

    // Arms (massive)
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, 0.25), fur);
      arm.position.set(s * 0.52, 1.0, 0);
      this.group.add(arm);
    }

    // Legs
    for (const s of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(s * 0.22, 0.5, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.3), darkFur);
      leg.position.y = -0.25;
      legGroup.add(leg);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  update(dt: number, playerPos: THREE.Vector3, playerHidden = false): void {
    if (this.isDead) {
      this.deathTimer += dt;
      this.group.rotation.z = Math.min(this.deathTimer * 2, Math.PI / 2);
      if (this.deathTimer > 3) this.group.visible = false;
      return;
    }

    // Hurt flash
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 10) % 2 === 0;
      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
          obj.material.emissive.setHex(flash ? 0xff0000 : 0x000000);
        }
      });
    }

    this.attackCooldown -= dt;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (this.config.hostile && dist < 25 && !playerHidden) {
      // Chase player
      this.currentYaw = Math.atan2(dx, dz);
      this.position.x += (dx / dist) * this.config.speed * dt;
      this.position.z += (dz / dist) * this.config.speed * dt;
    } else if (!this.config.hostile) {
      // Wander peacefully, flee if too close
      if (dist < 5) {
        this.currentYaw = Math.atan2(-dx, -dz);
        this.position.x -= (dx / dist) * this.config.speed * dt;
        this.position.z -= (dz / dist) * this.config.speed * dt;
      } else {
        // Gentle wander
        this.currentYaw += (Math.random() - 0.5) * dt;
        this.position.x += Math.sin(this.currentYaw) * this.config.speed * 0.3 * dt;
        this.position.z += Math.cos(this.currentYaw) * this.config.speed * 0.3 * dt;
      }
    }

    // Collision
    if (this.checkCollision()) {
      this.position.x -= Math.sin(this.currentYaw) * this.config.speed * dt;
      this.position.z -= Math.cos(this.currentYaw) * this.config.speed * dt;
      this.velocity.y = 5;
    }

    // Avoid water — reverse movement and turn around
    const footBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z)
    );
    if (footBlock === BlockId.WATER) {
      this.position.x -= Math.sin(this.currentYaw) * this.config.speed * dt;
      this.position.z -= Math.cos(this.currentYaw) * this.config.speed * dt;
      this.currentYaw += Math.PI;
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
    this.walkTime += dt * 4;
    const swing = Math.sin(this.walkTime) * 0.4;
    for (let i = 0; i < this.legs.length; i++) {
      this.legs[i]!.rotation.x = (i % 2 === 0 ? swing : -swing);
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    this.hurtTimer = 0.4;
    if (this.health <= 0) { this.isDead = true; this.deathTimer = 0; }
  }

  get radius(): number { return 0.8 * this.config.scale; }

  canAttack(): boolean { return this.config.hostile && this.attackCooldown <= 0 && !this.isDead; }
  doAttack(): number { this.attackCooldown = 1.5; return this.config.damage; }

  private checkCollision(): boolean {
    const hw = 0.3;
    for (let bx = Math.floor(this.position.x - hw); bx <= Math.floor(this.position.x + hw); bx++) {
      for (let by = Math.floor(this.position.y); by <= Math.floor(this.position.y + 1); by++) {
        for (let bz = Math.floor(this.position.z - hw); bz <= Math.floor(this.position.z + hw); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }
}
