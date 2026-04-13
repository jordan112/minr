import * as THREE from "three";
import { Player } from "./Player";
import { PlayerModel } from "./PlayerModel";
import { InputManager } from "../input/InputManager";
import { World } from "../world/World";
import { isSolid } from "../world/BlockType";
import {
  GRAVITY, JUMP_VELOCITY, PLAYER_HEIGHT, PLAYER_WIDTH,
  PLAYER_SPEED, MOUSE_SENSITIVITY, MAX_DELTA_TIME
} from "../utils/constants";

const THIRD_PERSON_DISTANCE = 5;
const THIRD_PERSON_HEIGHT_OFFSET = 2;

export class PlayerController {
  private player: Player;
  private camera: THREE.Camera;
  private input: InputManager;
  private world: World;
  playerModel: PlayerModel;
  isThirdPerson = true;
  isMoving = false;
  justJumped = false;

  constructor(player: Player, camera: THREE.Camera, input: InputManager, world: World, scene: THREE.Scene) {
    this.player = player;
    this.camera = camera;
    this.input = input;
    this.world = world;

    // Create player model
    this.playerModel = new PlayerModel();
    scene.add(this.playerModel.group);
  }

  toggleCamera(): void {
    this.isThirdPerson = !this.isThirdPerson;
    this.playerModel.group.visible = this.isThirdPerson;
  }

  update(dt: number): void {
    dt = Math.min(dt, MAX_DELTA_TIME);
    this.justJumped = false;

    this.handleMouse();
    this.handleMovement(dt);
    this.updateCamera();

    // Update player model
    this.playerModel.update(dt, this.isMoving, this.player.yaw, this.player.position);
  }

  private handleMouse(): void {
    if (!this.input.isPointerLocked) return;

    this.player.yaw -= this.input.mouseDX * MOUSE_SENSITIVITY;
    this.player.pitch += this.input.mouseDY * MOUSE_SENSITIVITY; // non-inverted: move mouse up = look up
    this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
  }

  private handleMovement(dt: number): void {
    const p = this.player;

    // Movement input
    let moveX = 0;
    let moveZ = 0;
    if (this.input.isKeyDown("KeyW") || this.input.isKeyDown("ArrowUp")) moveZ -= 1;
    if (this.input.isKeyDown("KeyS") || this.input.isKeyDown("ArrowDown")) moveZ += 1;
    if (this.input.isKeyDown("KeyA") || this.input.isKeyDown("ArrowLeft")) moveX -= 1;
    if (this.input.isKeyDown("KeyD") || this.input.isKeyDown("ArrowRight")) moveX += 1;

    this.isMoving = moveX !== 0 || moveZ !== 0;

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
      this.justJumped = true;
    }

    // Move with collision on each axis independently
    const halfW = PLAYER_WIDTH / 2;

    // X axis
    p.position.x += desiredVX * dt;
    if (this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
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
      p.position.y = Math.floor(p.position.y) + 1;
      p.velocity.y = 0;
      p.isGrounded = true;
    } else if (p.velocity.y > 0 && this.collidesAt(p.position.x, p.position.y, p.position.z, halfW)) {
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

  /** Get the look direction (used for raycasting from the camera) */
  getLookDirection(): THREE.Vector3 {
    const lookX = Math.sin(this.player.yaw) * Math.cos(this.player.pitch);
    const lookY = Math.sin(this.player.pitch);
    const lookZ = -Math.cos(this.player.yaw) * Math.cos(this.player.pitch);
    return new THREE.Vector3(lookX, lookY, lookZ).normalize();
  }

  /** Get the origin point for raycasting (eye position, not camera position) */
  getRayOrigin(): THREE.Vector3 {
    const p = this.player;
    return new THREE.Vector3(p.position.x, p.position.y + PLAYER_HEIGHT - 0.1, p.position.z);
  }

  private updateCamera(): void {
    const p = this.player;
    const eyeY = p.position.y + PLAYER_HEIGHT - 0.1;

    if (this.isThirdPerson) {
      // Camera orbits behind the player
      const lookDir = this.getLookDirection();

      // Camera position = behind and above the player
      const camX = p.position.x - lookDir.x * THIRD_PERSON_DISTANCE;
      const camY = eyeY + THIRD_PERSON_HEIGHT_OFFSET - lookDir.y * THIRD_PERSON_DISTANCE * 0.5;
      const camZ = p.position.z - lookDir.z * THIRD_PERSON_DISTANCE;

      this.camera.position.set(camX, camY, camZ);

      // Look at the player's head
      this.camera.lookAt(p.position.x, eyeY, p.position.z);
    } else {
      // First person — camera at eye height
      this.camera.position.set(p.position.x, eyeY, p.position.z);

      const lookDir = this.getLookDirection();
      this.camera.lookAt(
        p.position.x + lookDir.x,
        eyeY + lookDir.y,
        p.position.z + lookDir.z
      );
    }
  }
}
