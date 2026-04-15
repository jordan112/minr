import * as THREE from "three";
import { Player } from "./Player";
import { PlayerModel } from "./PlayerModel";
import { InputManager } from "../input/InputManager";
import { World } from "../world/World";
import { isSolid, BlockId } from "../world/BlockType";
import { isPowered } from "../world/RedstoneSystem";
import { ToolType } from "./ToolSystem";
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
  isThirdPerson = false;
  isMoving = false;
  justJumped = false;

  // First-person hand/tool view
  private fpHandGroup: THREE.Group;
  private fpToolGroups = new Map<ToolType, THREE.Group>();
  private currentFPTool: ToolType = ToolType.PICKAXE;
  private fpSwingTime = 0;
  private fpIsSwinging = false;

  constructor(player: Player, camera: THREE.Camera, input: InputManager, world: World, scene: THREE.Scene) {
    this.player = player;
    this.camera = camera;
    this.input = input;
    this.world = world;

    // Create player model (hidden in first person)
    this.playerModel = new PlayerModel();
    this.playerModel.group.visible = this.isThirdPerson;
    scene.add(this.playerModel.group);

    // First-person hand view — child of camera so it follows automatically
    this.fpHandGroup = new THREE.Group();
    // Position in camera-local space: right, down, forward
    this.fpHandGroup.position.set(0.35, -0.3, -0.45);
    this.fpHandGroup.scale.set(1.3, 1.3, 1.3);
    // Angle the tool like it's being held
    this.fpHandGroup.rotation.set(-0.2, -0.3, 0.4);
    this.buildFPTools();
    // Render on top of everything
    this.fpHandGroup.renderOrder = 999;
    this.fpHandGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material.depthTest = false;
        obj.renderOrder = 999;
      }
    });
    (this.camera as THREE.PerspectiveCamera).add(this.fpHandGroup);
    scene.add(this.camera);
    this.setFPTool(ToolType.PICKAXE);
  }

  private buildFPTools(): void {
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
    const swordMat = new THREE.MeshLambertMaterial({ color: 0xbbbbdd });
    const axeHeadMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const rodMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });

    // Hand (fist)
    const handGroup = new THREE.Group();
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), skin);
    handGroup.add(fist);
    this.fpToolGroups.set(ToolType.HAND, handGroup);
    this.fpHandGroup.add(handGroup);

    // Pickaxe
    const pickGroup = new THREE.Group();
    const pickHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), handleMat);
    pickGroup.add(pickHandle);
    const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), ironMat);
    pickHead.position.y = 0.25;
    pickGroup.add(pickHead);
    const pickTip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.05), ironMat);
    pickTip.position.set(0.18, 0.22, 0);
    pickTip.rotation.z = -0.4;
    pickGroup.add(pickTip);
    this.fpToolGroups.set(ToolType.PICKAXE, pickGroup);
    this.fpHandGroup.add(pickGroup);

    // Axe
    const axeGroup = new THREE.Group();
    const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), handleMat);
    axeGroup.add(axeHandle);
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), axeHeadMat);
    axeHead.position.set(0.1, 0.22, 0);
    axeGroup.add(axeHead);
    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.06), axeHeadMat);
    axeBlade.position.set(0.21, 0.22, 0);
    axeGroup.add(axeBlade);
    this.fpToolGroups.set(ToolType.AXE, axeGroup);
    this.fpHandGroup.add(axeGroup);

    // Sword
    const swordGroup = new THREE.Group();
    const swordHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), handleMat);
    swordHandle.position.y = -0.1;
    swordGroup.add(swordHandle);
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), ironMat);
    swordGroup.add(crossguard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.03), swordMat);
    blade.position.y = 0.22;
    swordGroup.add(blade);
    this.fpToolGroups.set(ToolType.SWORD, swordGroup);
    this.fpHandGroup.add(swordGroup);

    // Fishing rod
    const rodGroup = new THREE.Group();
    const rodPole = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.03), rodMat);
    rodGroup.add(rodPole);
    const rodTip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), rodMat);
    rodTip.position.y = 0.38;
    rodGroup.add(rodTip);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    line.position.y = 0.55;
    rodGroup.add(line);
    this.fpToolGroups.set(ToolType.FISHING_ROD, rodGroup);
    this.fpHandGroup.add(rodGroup);
  }

  setFPTool(tool: ToolType): void {
    this.currentFPTool = tool;
    for (const [type, group] of this.fpToolGroups) {
      group.visible = type === tool;
    }
  }

  triggerFPSwing(): void {
    this.fpIsSwinging = true;
    this.fpSwingTime = 0;
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

  /** Only update mouse look and camera — used when riding a boat */
  updateCameraOnly(dt: number): void {
    this.handleMouse();
    this.updateCamera();
    this.playerModel.update(dt, false, this.player.yaw, this.player.position);
  }

  private handleMouse(): void {
    if (!this.input.isPointerLocked) return;

    this.player.yaw += this.input.mouseDX * MOUSE_SENSITIVITY;
    this.player.pitch -= this.input.mouseDY * MOUSE_SENSITIVITY; // non-inverted: move mouse up = look up
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

    if (p.isCreative) {
      // Creative mode: fly with space (up) and shift (down)
      p.velocity.y = 0;
      if (this.input.isKeyDown("Space")) p.velocity.y = 8;
      if (this.input.isKeyDown("ShiftLeft")) p.velocity.y = -8;
    } else {
      // Gravity
      p.velocity.y -= GRAVITY * dt;

      // Jump
      if (this.input.isKeyDown("Space") && p.isGrounded) {
        p.velocity.y = JUMP_VELOCITY;
        p.isGrounded = false;
        this.justJumped = true;
      }
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
          const block = this.world.getBlock(bx, by, bz);
          if (isSolid(block)) {
            // Powered doors are passable
            if (block === BlockId.DOOR && isPowered(bx, by, bz)) continue;
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

    // First-person hand — it's a child of camera, so position is automatic
    // Just handle swing animation and walking bob
    this.fpHandGroup.visible = !this.isThirdPerson;

    if (!this.isThirdPerson) {
      // Reset to base position
      this.fpHandGroup.position.set(0.35, -0.3, -0.45);
      this.fpHandGroup.rotation.set(-0.2, -0.3, 0.4);

      // Swing animation
      if (this.fpIsSwinging) {
        this.fpSwingTime += 0.12;
        const swing = Math.sin(this.fpSwingTime * Math.PI) * 0.7;
        this.fpHandGroup.rotation.x -= swing;
        this.fpHandGroup.position.y -= swing * 0.1;
        if (this.fpSwingTime > 1) this.fpIsSwinging = false;
      }

      // Gentle bob while walking
      if (this.isMoving) {
        const t = performance.now() / 120;
        this.fpHandGroup.position.y += Math.sin(t) * 0.015;
        this.fpHandGroup.position.x += Math.cos(t * 0.5) * 0.008;
      }
    }
  }
}
