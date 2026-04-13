import * as THREE from "three";
import { SceneManager } from "./rendering/SceneManager";
import { TextureManager } from "./rendering/TextureManager";
import { World } from "./world/World";
import { Player } from "./player/Player";
import { PlayerController } from "./player/PlayerController";
import { InputManager } from "./input/InputManager";
import { VoxelRaycaster } from "./player/Raycaster";
import { HUD } from "./ui/HUD";
import { BlockId, PLACEABLE_BLOCKS, isSolid } from "./world/BlockType";
import { PLAYER_HEIGHT } from "./utils/constants";
import { SoundManager } from "./audio/SoundManager";
import { AnimalManager } from "./entities/AnimalManager";
import { ToolType, ALL_TOOLS, getToolDef } from "./player/ToolSystem";
import { AquaticManager } from "./entities/AquaticManager";
import { FishingGame } from "./ui/FishingGame";
import { SignManager } from "./entities/SignManager";
import { Villager } from "./entities/Villager";
import { Zombie } from "./entities/Zombie";

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
const fishingGame = new FishingGame();

const signs = new SignManager(sceneManager.scene, world);

// Villager NPCs
const villagers: Villager[] = [];
function spawnVillagers() {
  // Spawn 3 villagers near origin
  for (let i = 0; i < 3; i++) {
    const vx = (Math.random() - 0.5) * 20;
    const vz = (Math.random() - 0.5) * 20;
    const v = new Villager(world, vx, 80, vz);
    villagers.push(v);
    sceneManager.scene.add(v.group);
  }
}
spawnVillagers();

// Zombie enemies
const zombies: Zombie[] = [];
let zombieSpawnTimer = 5;
let dayTime = 0; // 0-1 day cycle, 0.5 = noon, 0 = midnight
const DAY_LENGTH = 120; // 2 minutes per full day

fishingGame.onCatch = (fishName) => {
  console.log("Caught:", fishName);
};

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

  // F to equip fishing rod
  if (e.code === "KeyF") {
    currentTool = ToolType.FISHING_ROD;
    controller.playerModel.setTool(currentTool);
    hud.setTool(currentTool);
  }

  // C to cast fishing line (when holding rod)
  if (e.code === "KeyC" && currentTool === ToolType.FISHING_ROD && fishingGame.state === "idle") {
    fishingGame.startFishing();
    controller.playerModel.triggerSwing();
    sound.playSplash();
  }

  // R to reset position
  if (e.code === "KeyR") {
    player.position.set(0, 80, 0);
    player.velocity.set(0, 0, 0);
  }
});

// --- Game Loop ---
let lastTime = performance.now();
let placeCooldown = 0;

function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt <= 0 || dt > 0.5) return;

  placeCooldown -= dt;

  // Update systems
  controller.update(dt);
  world.update(player.position.x, player.position.z);

  // Raycasting from the player's eye
  const rayOrigin = controller.getRayOrigin();
  const lookDir = controller.getLookDirection();
  raycaster.update(rayOrigin, lookDir);

  // Day/night cycle
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const isNight = dayTime < 0.25 || dayTime > 0.75;
  const sunAngle = dayTime * Math.PI * 2;
  const sunBrightness = Math.max(0, Math.cos(sunAngle - Math.PI));

  // Sky color transitions
  const nightColor = new THREE.Color(0x0a0a2a);
  const dayColor = new THREE.Color(0x87ceeb);
  const skyColor = nightColor.clone().lerp(dayColor, sunBrightness);
  sceneManager.renderer.setClearColor(skyColor);
  if (sceneManager.scene.fog instanceof THREE.Fog) {
    sceneManager.scene.fog.color.copy(skyColor);
  }

  // Ambient light intensity
  sceneManager.scene.traverse((obj) => {
    if (obj instanceof THREE.AmbientLight) {
      obj.intensity = 0.15 + sunBrightness * 0.35;
    }
    if (obj instanceof THREE.DirectionalLight) {
      obj.intensity = 0.2 + sunBrightness * 0.6;
    }
  });

  // Player hurt cooldown
  player.hurtCooldown -= dt;

  // Lava damage
  const blockAtFeet = world.getBlock(
    Math.floor(player.position.x),
    Math.floor(player.position.y),
    Math.floor(player.position.z)
  );
  if (blockAtFeet === BlockId.LAVA) {
    player.takeDamage(2);
  }

  // Respawn if dead
  if (player.isDead) {
    player.health = player.maxHealth;
    player.position.set(0, 80, 0);
    player.velocity.set(0, 0, 0);
  }

  // Update animals, aquatic creatures, and signs
  animals.update(dt, player.position.x, player.position.z);
  aquatics.update(dt, player.position.x, player.position.z);
  signs.update(dt, player.position.x, player.position.z);

  // Update villagers
  for (const v of villagers) {
    v.update(dt, player.position);
  }

  // Zombie spawning (more at night)
  zombieSpawnTimer -= dt;
  if (zombieSpawnTimer <= 0 && zombies.length < (isNight ? 10 : 3)) {
    zombieSpawnTimer = isNight ? 3 : 15;
    const angle = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 15;
    const zx = player.position.x + Math.cos(angle) * dist;
    const zz = player.position.z + Math.sin(angle) * dist;
    // Find ground
    let zy = -1;
    for (let y = 80; y >= 1; y--) {
      if (isSolid(world.getBlock(Math.floor(zx), y, Math.floor(zz)))) {
        zy = y + 1;
        break;
      }
    }
    if (zy > 0) {
      const zombie = new Zombie(world, zx, zy, zz);
      zombies.push(zombie);
      sceneManager.scene.add(zombie.group);
    }
  }

  // Update zombies
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i]!;
    z.update(dt, player.position);

    // Remove dead zombies after animation
    if (z.isDead && !z.group.visible) {
      sceneManager.scene.remove(z.group);
      zombies.splice(i, 1);
      continue;
    }

    // Zombie attacks player
    if (!z.isDead) {
      const dx = z.position.x - player.position.x;
      const dz = z.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5 && z.canAttack()) {
        player.takeDamage(3);
        z.doAttack();
      }

      // Despawn far zombies
      if (dist > 60) {
        sceneManager.scene.remove(z.group);
        zombies.splice(i, 1);
      }
    }
  }

  // Player-zombie collision
  for (const z of zombies) {
    if (z.isDead) continue;
    const dx = player.position.x - z.position.x;
    const dz = player.position.z - z.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.8 && dist > 0.01) {
      const push = (0.8 - dist) / dist;
      player.position.x += dx * push;
      player.position.z += dz * push;
    }
  }

  // Animal sounds
  for (const animal of animals.getAnimals()) {
    if (animal.wantsToSpeak && !animal.isDead) {
      // Only play if close enough to hear
      const dx = animal.position.x - player.position.x;
      const dz = animal.position.z - player.position.z;
      if (dx * dx + dz * dz < 30 * 30) {
        if (animal.type === "cow") sound.playCow();
        else if (animal.type === "pig") sound.playPig();
        else if (animal.type === "sheep") sound.playSheep();
      }
    }
  }

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

  // Update fishing mini-game
  fishingGame.update(dt);

  // Left click: fishing, attack, or break
  if (input.leftClick) {
    if (currentTool === ToolType.FISHING_ROD) {
      // Fishing rod: cast or interact with mini-game
      if (fishingGame.state === "idle") {
        // Cast — just start fishing (don't require aiming at water)
        fishingGame.startFishing();
        controller.playerModel.triggerSwing();
        sound.playSplash();
      } else if (fishingGame.state === "bite" || fishingGame.state === "reeling") {
        fishingGame.onMouseDown();
      }
    } else {
      // Normal attack/break
      const attackOrigin = controller.getRayOrigin();
      const attackDir = controller.getLookDirection();
      const attackPoint = attackOrigin.clone().add(attackDir.clone().multiplyScalar(3));
      const toolDef = getToolDef(currentTool);

      const target = animals.findNearestInRange(
        attackPoint.x, attackPoint.y, attackPoint.z, 2.5
      );

      const aquaticTarget = aquatics.findNearestInRange(
        attackPoint.x, attackPoint.y, attackPoint.z, 2.5
      );

      // Check zombies
      let zombieTarget: Zombie | null = null;
      let zombieDist = 3 * 3;
      for (const z of zombies) {
        if (z.isDead) continue;
        const zdx = z.position.x - attackPoint.x;
        const zdy = z.position.y - attackPoint.y;
        const zdz = z.position.z - attackPoint.z;
        const zd = zdx * zdx + zdy * zdy + zdz * zdz;
        if (zd < zombieDist) { zombieDist = zd; zombieTarget = z; }
      }

      if (zombieTarget) {
        zombieTarget.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
      } else if (target) {
        target.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
      } else if (aquaticTarget) {
        aquaticTarget.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
      } else if (raycaster.lastHit) {
        const [bx, by, bz] = raycaster.lastHit.blockPos;
        world.setBlock(bx, by, bz, BlockId.AIR);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
      }
    }
  }

  // Fishing reeling: hold mouse to reel
  if (fishingGame.state === "reeling") {
    if (input.leftHeld) {
      fishingGame.onMouseDown();
    } else {
      fishingGame.onMouseUp();
    }
  }

  // Cancel fishing if tool changes
  if (currentTool !== ToolType.FISHING_ROD && fishingGame.state !== "idle") {
    fishingGame.cancelFishing();
  }

  // Place block: right-click OR B key (one-shot via placeCooldown)
  const wantsPlace = input.rightClick || input.isKeyDown("KeyB");
  if (wantsPlace && raycaster.lastHit && placeCooldown <= 0) {
    placeCooldown = 0.2; // 200ms cooldown to prevent spam
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

  hud.debugInfo.animals = animals.getAnimals().length;
  hud.debugInfo.fish = aquatics.getCreatures().length;
  hud.debugInfo.zombies = zombies.length;
  hud.dayTime = dayTime;
  hud.update(player, dt);
  input.resetFrame();
  sceneManager.render();
}

requestAnimationFrame(gameLoop);
