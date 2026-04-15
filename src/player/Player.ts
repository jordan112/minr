import * as THREE from "three";

export class Player {
  position = new THREE.Vector3(0, 80, 0);
  velocity = new THREE.Vector3(0, 0, 0);
  yaw = 0;
  pitch = 0;
  isGrounded = false;
  selectedBlockIndex = 0;
  health = 20;
  maxHealth = 20;
  hurtCooldown = 0;
  xp = 0;
  level = 1;
  isCreative = false;

  addXP(amount: number): boolean {
    this.xp += amount;
    const needed = this.level * 20;
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.maxHealth += 2;
      this.health = this.maxHealth;
      return true; // leveled up!
    }
    return false;
  }

  takeDamage(amount: number): void {
    if (this.isCreative) return; // no damage in creative
    if (this.hurtCooldown > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtCooldown = 0.5; // invincibility frames
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get isDead(): boolean {
    return this.health <= 0;
  }
}
