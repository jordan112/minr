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

// --- Init ---
const canvas = document.getElementById("game") as HTMLCanvasElement;
const sceneManager = new SceneManager(canvas);
const textureManager = new TextureManager();
const world = new World(sceneManager.scene, textureManager);
const player = new Player();
const input = new InputManager(canvas);
const controller = new PlayerController(player, sceneManager.camera, input, world);
const raycaster = new VoxelRaycaster(world, sceneManager.scene);
const hud = new HUD();

// Block selection
hud.onBlockSelect = (index) => {
  player.selectedBlockIndex = index;
};

document.addEventListener("keydown", (e) => {
  const num = parseInt(e.key);
  if (num >= 1 && num <= PLACEABLE_BLOCKS.length) {
    player.selectedBlockIndex = num - 1;
  }
});

// --- Game Loop ---
let lastTime = performance.now();

function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt <= 0 || dt > 0.5) return; // skip weird frames

  // Update systems
  controller.update(dt);
  world.update(player.position.x, player.position.z);

  // Raycasting for block highlight
  const lookDir = new THREE.Vector3();
  sceneManager.camera.getWorldDirection(lookDir);
  raycaster.update(sceneManager.camera.position, lookDir);

  // Block interaction
  if (input.leftClick && raycaster.lastHit) {
    const [bx, by, bz] = raycaster.lastHit.blockPos;
    world.setBlock(bx, by, bz, BlockId.AIR);
  }

  if (input.rightClick && raycaster.lastHit) {
    const [bx, by, bz] = raycaster.lastHit.blockPos;
    const [nx, ny, nz] = raycaster.lastHit.faceNormal;
    const placeX = bx + nx;
    const placeY = by + ny;
    const placeZ = bz + nz;

    // Don't place block inside the player
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const playerOverlaps =
      placeX >= Math.floor(px - 0.3) && placeX <= Math.floor(px + 0.3) &&
      placeZ >= Math.floor(pz - 0.3) && placeZ <= Math.floor(pz + 0.3) &&
      placeY >= Math.floor(py) && placeY <= Math.floor(py + PLAYER_HEIGHT);

    if (!playerOverlaps) {
      world.setBlock(placeX, placeY, placeZ, PLACEABLE_BLOCKS[player.selectedBlockIndex]!);
    }
  }

  hud.update(player, dt);
  input.resetFrame();
  sceneManager.render();
}

requestAnimationFrame(gameLoop);
