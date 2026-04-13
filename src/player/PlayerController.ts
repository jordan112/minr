import * as THREE from "three";
import { Player } from "./Player";
import { InputManager } from "../input/InputManager";
import { World } from "../world/World";
import { isSolid } from "../world/BlockType";
import {
  GRAVITY, JUMP_VELOCITY, PLAYER_HEIGHT, PLAYER_WIDTH,
  PLAYER_SPEED, MOUSE_SENSITIVITY, MAX_DELTA_TIME
} from "../utils/constants";

export class PlayerController {
  private player: Player;
  private camera: THREE.Camera;
  private input: InputManager;
  private world: World;

  constructor(player: Player, camera: THREE.Camera, input: InputManager, world: World) {
    this.player = player;
    this.camera = camera;
    this.input = input;
    this.world = world;
  }

  update(dt: number): void {
    dt = Math.min(dt, MAX_DELTA_TIME);

    this.handleMouse();
    this.handleMovement(dt);
    this.updateCamera();
  }

  private handleMouse(): void {
    if (!this.input.isPointerLocked) return;

    this.player.yaw -= this.input.mouseDX * MOUSE_SENSITIVITY;
    this.player.pitch -= this.input.mouseDY * MOUSE_SENSITIVITY;
    this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
  }

  private handleMovement(dt: number): void {
    const p = this.player;

    // Movement input
    let moveX = 0;
    let moveZ = 0;
    if (this.input.isKeyDown("KeyW")) moveZ -= 1;
    if (this.input.isKeyDown("KeyS")) moveZ += 1;
    if (this.input.isKeyDown("KeyA")) moveX -= 1;
    if (this.input.isKeyDown("KeyD")) moveX += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Rotate movement by yaw
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    const worldMoveX = moveX * cos - moveZ * sin;
    const worldMoveZ = moveX * sin + moveZ * cos;

    // Apply horizontal velocity
    const speed = PLAYER_SPEED;
    const desiredVX = worldMoveX * speed;
    const desiredVZ = worldMoveZ * speed;

    // Gravity
    p.velocity.y -= GRAVITY * dt;

    // Jump
    if (this.input.isKeyDown("Space") && p.isGrounded) {
      p.velocity.y = JUMP_VELOCITY;
      p.isGrounded = false;
    }

    // Move with collision on each axis independently
    const halfW = PLAYER_WIDTH / 2;

    // X axis
    p.position.x += desiredVX * dt;
    if (this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
      // Push out
      p.position.x -= desiredVX * dt;
    }

    // Z axis
    p.position.z += desiredVZ * dt;
    if (this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
      p.position.z -= desiredVZ * dt;
    }

    // Y axis
    p.position.y += p.velocity.y * dt;
    if (p.velocity.y < 0 && this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
      // Snap to block top
      p.position.y = Math.floor(p.position.y) + 1;
      p.velocity.y = 0;
      p.isGrounded = true;
    } else if (p.velocity.y > 0 && this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
      // Hit ceiling
      p.velocity.y = 0;
    } else {
      p.isGrounded = false;
    }

    // Prevent falling below world
    if (p.position.y < 0) {
      p.position.y = 80;
      p.velocity.y = 0;
    }
  }

  private collidesAt(x: number, y: number, z: number, halfW: number): boolean {
    // Check all blocks the player AABB overlaps
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateCamera(): void {
    const p = this.player;
    // Camera at eye height
    this.camera.position.set(p.position.x, p.position.y + PLAYER_HEIGHT - 0.1, p.position.z);

    // Look direction from yaw/pitch
    const lookX = Math.sin(p.yaw) * Math.cos(p.pitch);
    const lookY = Math.sin(p.pitch);
    const lookZ = -Math.cos(p.yaw) * Math.cos(p.pitch); // negative Z = forward in Three.js

    this.camera.lookAt(
      p.position.x + lookX,
      p.position.y + PLAYER_HEIGHT - 0.1 + lookY,
      p.position.z + lookZ
    );
  }
}
