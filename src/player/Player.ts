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

  takeDamage(amount: number): void {
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
