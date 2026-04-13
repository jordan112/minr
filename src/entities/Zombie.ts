import * as THREE from "three";
import { World } from "../world/World";
import { isSolid } from "../world/BlockType";

export class Zombie {
  group: THREE.Group;
  position: THREE.Vector3;
  health = 15;
  isDead = false;
  private world: World;
  private velocity = new THREE.Vector3();
  private currentYaw = 0;
  private walkTime = 0;
  private hurtTimer = 0;
  private deathTimer = 0;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  attackCooldown = 0;

  constructor(world: World, x: number, y: number, z: number) {
    this.world = world;
    this.position = new THREE.Vector3(x, y, z);
    this.group = new THREE.Group();
    this.currentYaw = Math.random() * Math.PI * 2;

    const zombieSkin = new THREE.MeshLambertMaterial({ color: 0x4a7a4a }); // green skin
    const zombieDark = new THREE.MeshLambertMaterial({ color: 0x3a5a3a });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x3a6a6a }); // torn teal shirt
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a5a }); // dark pants
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // red eyes!

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), zombieSkin);
    head.position.y = 1.55;
    this.group.add(head);

    // Red glowing eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), eyeMat);
      eye.position.set(side * 0.12, 1.58, 0.26);
      this.group.add(eye);
    }

    // Mouth (dark line)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), zombieDark);
    mouth.position.set(0, 1.45, 0.26);
    this.group.add(mouth);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
    body.position.y = 0.975;
    this.group.add(body);

    // Arms — stretched forward (zombie pose!)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.375, 1.3, 0);
    this.leftArm.rotation.x = -1.4; // arms stretched forward
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), zombieSkin);
    leftArmMesh.position.y = -0.35;
    this.leftArm.add(leftArmMesh);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.375, 1.3, 0);
    this.rightArm.rotation.x = -1.4;
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), zombieSkin);
    rightArmMesh.position.y = -0.35;
    this.rightArm.add(rightArmMesh);
    this.group.add(this.rightArm);

    // Legs
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.125, 0.6, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.27), pants);
    leftLegMesh.position.y = -0.3;
    this.leftLeg.add(leftLegMesh);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.125, 0.6, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.27), pants);
    rightLegMesh.position.y = -0.3;
    this.rightLeg.add(rightLegMesh);
    this.group.add(this.rightLeg);
  }

  update(dt: number, playerPos: THREE.Vector3, playerHidden = false): void {
    if (this.isDead) {
      this.deathTimer += dt;
      this.group.rotation.z = Math.min(this.deathTimer * 3, Math.PI / 2);
      this.group.position.y = this.position.y - this.deathTimer * 0.5;
      if (this.deathTimer > 2) this.group.visible = false;
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

    // Chase player
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 30 && !playerHidden) {
      // Chase player
      this.currentYaw = Math.atan2(dx, dz);
      const speed = 1.8;
      this.position.x += (dx / dist) * speed * dt;
      this.position.z += (dz / dist) * speed * dt;

      if (this.checkCollision()) {
        this.position.x -= (dx / dist) * speed * dt;
        this.position.z -= (dz / dist) * speed * dt;
        this.velocity.y = 6;
      }
    } else {
      // Wander aimlessly when can't see player
      this.currentYaw += (Math.random() - 0.5) * dt * 2;
      const speed = 0.6;
      this.position.x += Math.sin(this.currentYaw) * speed * dt;
      this.position.z += Math.cos(this.currentYaw) * speed * dt;
      if (this.checkCollision()) {
        this.position.x -= Math.sin(this.currentYaw) * speed * dt;
        this.position.z -= Math.cos(this.currentYaw) * speed * dt;
        this.currentYaw += Math.PI;
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
    this.walkTime += dt * 6;
    const swing = Math.sin(this.walkTime) * 0.5;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    // Arms stay stretched forward, slight bob
    this.leftArm.rotation.x = -1.4 + Math.sin(this.walkTime * 0.5) * 0.1;
    this.rightArm.rotation.x = -1.4 - Math.sin(this.walkTime * 0.5) * 0.1;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentYaw;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    this.hurtTimer = 0.4;
    if (this.health <= 0) {
      this.isDead = true;
      this.deathTimer = 0;
    }
  }

  get radius(): number { return 0.5; }

  canAttack(): boolean {
    return this.attackCooldown <= 0 && !this.isDead;
  }

  doAttack(): void {
    this.attackCooldown = 1.0;
  }

  private checkCollision(): boolean {
    const hw = 0.3;
    for (let bx = Math.floor(this.position.x - hw); bx <= Math.floor(this.position.x + hw); bx++) {
      for (let by = Math.floor(this.position.y); by <= Math.floor(this.position.y + 1.5); by++) {
        for (let bz = Math.floor(this.position.z - hw); bz <= Math.floor(this.position.z + hw); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }
}
