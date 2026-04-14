import * as THREE from "three";
import { World } from "../world/World";
import { isSolid, BlockId } from "../world/BlockType";
import { SEA_LEVEL } from "../utils/constants";

export class MountainGoat {
  group: THREE.Group;
  position: THREE.Vector3;
  health = 12;
  isDead = false;
  private world: World;
  private velocity = new THREE.Vector3();
  private currentYaw = 0;
  private targetYaw = 0;
  private moveTimer = 0;
  private idleTimer = 0;
  private isMoving = false;
  private walkTime = 0;
  private legs: THREE.Group[] = [];
  private deathTimer = 0;
  soundTimer = 6 + Math.random() * 12;
  wantsToBleat = false;

  constructor(world: World, x: number, y: number, z: number) {
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.currentYaw;
    this.buildModel();
    this.pickNewDirection();
  }

  private buildModel(): void {
    const fur = new THREE.MeshLambertMaterial({ color: 0xddddcc });
    const darkFur = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const horn = new THREE.MeshLambertMaterial({ color: 0x555544 });
    const eye = new THREE.MeshLambertMaterial({ color: 0x332200 });
    const hoof = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.7), fur);
    body.position.y = 0.55;
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.3), fur);
    head.position.set(0, 0.65, 0.45);
    this.group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.1), darkFur);
    snout.position.set(0, 0.58, 0.6);
    this.group.add(snout);

    // Horns (curved back)
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), horn);
      h.position.set(s * 0.1, 0.82, 0.4);
      h.rotation.x = 0.4;
      this.group.add(h);
    }

    // Eyes
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), eye);
      e.position.set(s * 0.1, 0.68, 0.58);
      this.group.add(e);
    }

    // Beard
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.04), darkFur);
    beard.position.set(0, 0.5, 0.55);
    this.group.add(beard);

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), fur);
    tail.position.set(0, 0.6, -0.38);
    this.group.add(tail);

    // Legs (4, thin)
    for (const [ox, oz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]] as [number, number][]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(ox, 0.3, oz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), fur);
      leg.position.y = -0.15;
      legGroup.add(leg);
      const hoofMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.11), hoof);
      hoofMesh.position.y = -0.32;
      legGroup.add(hoofMesh);
      this.group.add(legGroup);
      this.legs.push(legGroup);
    }
  }

  private pickNewDirection(): void {
    this.targetYaw = Math.random() * Math.PI * 2;
    this.moveTimer = 2 + Math.random() * 4;
    this.idleTimer = 1 + Math.random() * 3;
    this.isMoving = Math.random() > 0.4;
  }

  update(dt: number): void {
    if (this.isDead) {
      this.deathTimer += dt;
      this.group.rotation.z = Math.min(this.deathTimer * 3, Math.PI / 2);
      if (this.deathTimer > 2) this.group.visible = false;
      return;
    }

    // Bleat sound
    this.wantsToBleat = false;
    this.soundTimer -= dt;
    if (this.soundTimer <= 0) {
      this.soundTimer = 8 + Math.random() * 15;
      this.wantsToBleat = true;
    }

    // AI
    if (this.isMoving) {
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) { this.isMoving = false; this.idleTimer = 2 + Math.random() * 4; }
    } else {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) this.pickNewDirection();
    }

    // Smooth yaw
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.currentYaw += yawDiff * Math.min(1, dt * 3);

    if (this.isMoving) {
      const speed = 1.5;
      this.position.x += Math.sin(this.currentYaw) * speed * dt;
      this.position.z += Math.cos(this.currentYaw) * speed * dt;
      if (this.checkCollision()) {
        this.position.x -= Math.sin(this.currentYaw) * speed * dt;
        this.position.z -= Math.cos(this.currentYaw) * speed * dt;
        // Goats can jump up blocks!
        this.velocity.y = 7;
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
    if (this.isMoving) { this.walkTime += dt * 7; } else { this.walkTime *= 0.85; }
    const swing = Math.sin(this.walkTime) * 0.5;
    if (this.legs[0]) this.legs[0].rotation.x = swing;
    if (this.legs[1]) this.legs[1].rotation.x = swing;
    if (this.legs[2]) this.legs[2].rotation.x = -swing;
    if (this.legs[3]) this.legs[3].rotation.x = -swing;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
        obj.material.emissive.setHex(0xff0000);
        setTimeout(() => {
          if (obj.material instanceof THREE.MeshLambertMaterial) obj.material.emissive.setHex(0);
        }, 200);
      }
    });
    if (this.health <= 0) { this.isDead = true; this.deathTimer = 0; }
  }

  get radius(): number { return 0.4; }

  private checkCollision(): boolean {
    const hw = 0.2;
    for (let bx = Math.floor(this.position.x - hw); bx <= Math.floor(this.position.x + hw); bx++) {
      for (let by = Math.floor(this.position.y); by <= Math.floor(this.position.y + 0.6); by++) {
        for (let bz = Math.floor(this.position.z - hw); bz <= Math.floor(this.position.z + hw); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }
}
