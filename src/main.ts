import * as THREE from "three";
import { SceneManager } from "./rendering/SceneManager";
import { TextureManager } from "./rendering/TextureManager";
import { World } from "./world/World";
import { Player } from "./player/Player";
import { PlayerController } from "./player/PlayerController";
import { InputManager } from "./input/InputManager";
import { VoxelRaycaster } from "./player/Raycaster";
import { HUD } from "./ui/HUD";
import { BlockId, PLACEABLE_BLOCKS } from "./world/BlockType";
import { PLAYER_HEIGHT } from "./utils/constants";
import { SoundManager } from "./audio/SoundManager";
import { AnimalManager } from "./entities/AnimalManager";
import { ToolType, ALL_TOOLS, getToolDef } from "./player/ToolSystem";
import { AquaticManager } from "./entities/AquaticManager";

// --- Init ---
const canvas = document.getElementById("game") as HTMLCanvasElement;
const sceneManager = new SceneManager(canvas);
const textureManager = new TextureManager();
const world = new World(sceneManager.scene, textureManager);
const player = new Player();
const input = new InputManager(canvas);
const controller = new PlayerController(player, sceneManager.camera, input, world, sceneManager.scene);
const raycaster = new VoxelRaycaster(world, sceneManager.scene);
const hud = new HUD();
const sound = new SoundManager();
const animals = new AnimalManager(sceneManager.scene, world);
const aquatics = new AquaticManager(sceneManager.scene, world);

// Block selection
hud.onBlockSelect = (index) => {
  player.selectedBlockIndex = index;
};
hud.onPlay = () => {
  sound.init();
  sound.startMusic();
};
hud.onToolSelect = (tool) => {
  currentTool = tool;
  controller.playerModel.setTool(tool);
  hud.setTool(tool);
};

// Also init audio on any click/key as fallback
document.addEventListener("click", () => sound.init(), { once: true });

// Current tool
let currentTool: ToolType = ToolType.PICKAXE;

document.addEventListener("keydown", (e) => {
  // Block selection: hold shift + number for blocks
  const num = parseInt(e.key);

  // Tab to cycle tools
  if (e.code === "Tab") {
    e.preventDefault();
    const idx = ALL_TOOLS.indexOf(currentTool);
    currentTool = ALL_TOOLS[(idx + 1) % ALL_TOOLS.length]!;
    controller.playerModel.setTool(currentTool);
    hud.setTool(currentTool);
  }

  // Q to cycle tools backward
  if (e.code === "KeyQ") {
    const idx = ALL_TOOLS.indexOf(currentTool);
    currentTool = ALL_TOOLS[(idx - 1 + ALL_TOOLS.length) % ALL_TOOLS.length]!;
    controller.playerModel.setTool(currentTool);
    hud.setTool(currentTool);
  }

  // Number keys for block selection
  if (num >= 1 && num <= PLACEABLE_BLOCKS.length) {
    player.selectedBlockIndex = num - 1;
  }

  if (e.code === "KeyV") {
    controller.toggleCamera();
  }

  if (e.code === "KeyM") {
    sound.toggleMusic();
  }
});

// --- Game Loop ---
let lastTime = performance.now();

function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt <= 0 || dt > 0.5) return;

  // Update systems
  controller.update(dt);
  world.update(player.position.x, player.position.z);

  // Raycasting from the player's eye
  const rayOrigin = controller.getRayOrigin();
  const lookDir = controller.getLookDirection();
  raycaster.update(rayOrigin, lookDir);

  // Update animals and aquatic creatures
  animals.update(dt, player.position.x, player.position.z);
  aquatics.update(dt, player.position.x, player.position.z);

  // Player-animal collision (push player away from animals)
  for (const animal of animals.getAnimals()) {
    if (animal.isDead) continue;
    const dx = player.position.x - animal.position.x;
    const dz = player.position.z - animal.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = animal.radius + 0.3; // animal radius + player half-width
    if (dist < minDist && dist > 0.01) {
      const push = (minDist - dist) / dist;
      player.position.x += dx * push;
      player.position.z += dz * push;
    }
  }

  // Sound: footsteps and jump
  sound.updateFootsteps(dt, controller.isMoving, player.isGrounded);
  if (controller.justJumped) sound.playJump();

  // Left click: attack animal or break block
  if (input.leftClick) {
    // Check for animal in attack range first
    const attackOrigin = controller.getRayOrigin();
    const attackDir = controller.getLookDirection();
    const attackPoint = attackOrigin.clone().add(attackDir.clone().multiplyScalar(3));
    const toolDef = getToolDef(currentTool);

    const target = animals.findNearestInRange(
      attackPoint.x, attackPoint.y, attackPoint.z, 2.5
    );

    // Also check aquatic creatures
    const aquaticTarget = aquatics.findNearestInRange(
      attackPoint.x, attackPoint.y, attackPoint.z, 2.5
    );

    if (target) {
      target.takeDamage(toolDef.damage);
      controller.playerModel.triggerSwing();
      sound.playBlockBreak();
    } else if (aquaticTarget) {
      aquaticTarget.takeDamage(toolDef.damage);
      controller.playerModel.triggerSwing();
      sound.playBlockBreak();
    } else if (raycaster.lastHit) {
      // Break block
      const [bx, by, bz] = raycaster.lastHit.blockPos;
      world.setBlock(bx, by, bz, BlockId.AIR);
      controller.playerModel.triggerSwing();
      sound.playBlockBreak();
    }
  }

  // Right click: place block
  if (input.rightClick && raycaster.lastHit) {
    const [bx, by, bz] = raycaster.lastHit.blockPos;
    const [nx, ny, nz] = raycaster.lastHit.faceNormal;
    const placeX = bx + nx;
    const placeY = by + ny;
    const placeZ = bz + nz;

    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const playerOverlaps =
      placeX >= Math.floor(px - 0.3) && placeX <= Math.floor(px + 0.3) &&
      placeZ >= Math.floor(pz - 0.3) && placeZ <= Math.floor(pz + 0.3) &&
      placeY >= Math.floor(py) && placeY <= Math.floor(py + PLAYER_HEIGHT);

    if (!playerOverlaps) {
      world.setBlock(placeX, placeY, placeZ, PLACEABLE_BLOCKS[player.selectedBlockIndex]!);
      sound.playBlockPlace();
    }
  }

  hud.update(player, dt);
  input.resetFrame();
  sceneManager.render();
}

requestAnimationFrame(gameLoop);
