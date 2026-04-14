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
import { Animal } from "./entities/Animal";
import { ToolType, ALL_TOOLS, getToolDef } from "./player/ToolSystem";
import { AquaticManager } from "./entities/AquaticManager";
import { FishingGame } from "./ui/FishingGame";
import { SignManager } from "./entities/SignManager";
import { Villager } from "./entities/Villager";
import { Zombie } from "./entities/Zombie";
import { RareCreature, ALL_RARE_TYPES } from "./entities/RareCreature";
import type { RareType } from "./entities/RareCreature";
import { LootPopup, rollLoot } from "./ui/LootPopup";
import { Boat } from "./entities/Boat";
import { SaveManager } from "./save/SaveManager";

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
const loot = new LootPopup();
const saveManager = new SaveManager();

// Villager NPCs
const villagers: Villager[] = [];
function spawnVillagers() {
  for (let i = 0; i < 3; i++) {
    // Find a land position near origin
    for (let attempt = 0; attempt < 20; attempt++) {
      const vx = (Math.random() - 0.5) * 30;
      const vz = (Math.random() - 0.5) * 30;
      let vy = -1;
      for (let y = 80; y >= 1; y--) {
        const block = world.getBlock(Math.floor(vx), y, Math.floor(vz));
        if (block === BlockId.GRASS || block === BlockId.DIRT || block === BlockId.SAND) {
          vy = y + 1;
          break;
        }
        if (block === BlockId.WATER) break; // skip water spots
      }
      if (vy > 0) {
        const v = new Villager(world, vx, vy, vz);
        villagers.push(v);
        sceneManager.scene.add(v.group);
        break;
      }
    }
  }
}
// Delay villager spawn so chunks are loaded first
setTimeout(spawnVillagers, 1000);

// Zombie enemies
const zombies: Zombie[] = [];
let zombieSpawnTimer = 5;
let dayTime = 0.25; // start at sunrise
const DAY_LENGTH = 120;
let isPaused = false;

// Rare creatures
const rareCreatures: RareCreature[] = [];
let rareSpawnTimer = 30;

// Boats
const boats: Boat[] = [];
let boatSpawnTimer = 5;
let ridingBoat: Boat | null = null;

// Auto-load saved game if exists
const savedGame = saveManager.load();
if (savedGame) {
  dayTime = saveManager.applyLoad(savedGame, player, world);
}

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

  // C to cast fishing line (when holding rod and looking at water)
  if (e.code === "KeyC" && currentTool === ToolType.FISHING_ROD && fishingGame.state === "idle" && raycaster.lastWaterHit) {
    fishingGame.startFishing();
    controller.playerModel.triggerSwing();
    sound.playSplash();
  }

  // P to pause
  if (e.code === "KeyP") {
    isPaused = !isPaused;
  }

  // G to open spawn menu
  if (e.code === "KeyG") {
    showSpawnMenu();
  }

  // Ctrl+S / Digit0 to save
  if ((e.code === "KeyS" && (e.ctrlKey || e.metaKey)) || e.code === "Digit0") {
    e.preventDefault();
    saveManager.save(player, world, dayTime);
  }

  // L to load
  if (e.code === "KeyL") {
    const data = saveManager.load();
    if (data) {
      dayTime = saveManager.applyLoad(data, player, world);
    }
  }

  // X to enter/exit boat
  if (e.code === "KeyX") {
    if (ridingBoat) {
      // Exit boat
      ridingBoat.isOccupied = false;
      ridingBoat = null;
      player.position.y += 1;
    } else {
      // Find nearest boat
      let nearestBoat: Boat | null = null;
      let nearestDist = 4;
      for (const b of boats) {
        const bdx = b.position.x - player.position.x;
        const bdz = b.position.z - player.position.z;
        const bd = Math.sqrt(bdx * bdx + bdz * bdz);
        if (bd < nearestDist) { nearestDist = bd; nearestBoat = b; }
      }
      if (nearestBoat) {
        ridingBoat = nearestBoat;
        ridingBoat.isOccupied = true;
      }
    }
  }

  // R to reset position
  if (e.code === "KeyR") {
    player.position.set(0, 80, 0);
    player.velocity.set(0, 0, 0);
  }
});

// Spawn menu
function showSpawnMenu() {
  const existing = document.getElementById("spawn-menu");
  if (existing) { existing.remove(); return; }

  const menu = document.createElement("div");
  menu.id = "spawn-menu";
  Object.assign(menu.style, {
    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
    background: "rgba(0,0,0,0.85)", padding: "20px", borderRadius: "10px",
    color: "white", fontFamily: "monospace", fontSize: "14px", zIndex: "300",
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", minWidth: "300px",
  });

  const title = document.createElement("div");
  title.textContent = "SPAWN CREATURE (G to close)";
  title.style.gridColumn = "1/3";
  title.style.textAlign = "center";
  title.style.fontWeight = "bold";
  title.style.marginBottom = "8px";
  menu.appendChild(title);

  const spawns = [
    { label: "Sheep", fn: () => spawnAnimalAt("sheep") },
    { label: "Pig", fn: () => spawnAnimalAt("pig") },
    { label: "Cow", fn: () => spawnAnimalAt("cow") },
    { label: "Zombie", fn: () => spawnZombieAt() },
    { label: "T-Rex", fn: () => spawnRareAt("trex") },
    { label: "Bigfoot", fn: () => spawnRareAt("bigfoot") },
    { label: "Dragon", fn: () => spawnRareAt("dragon") },
    { label: "Unicorn", fn: () => spawnRareAt("unicorn") },
    { label: "Yeti", fn: () => spawnRareAt("yeti") },
    { label: "Villager", fn: () => spawnVillagerAt() },
  ];

  for (const s of spawns) {
    const btn = document.createElement("button");
    btn.textContent = s.label;
    Object.assign(btn.style, {
      padding: "8px", background: "#444", color: "white", border: "1px solid #666",
      borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "13px",
    });
    btn.addEventListener("click", () => { s.fn(); menu.remove(); });
    btn.addEventListener("mouseenter", () => { btn.style.background = "#666"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "#444"; });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
}

function getSpawnPos(): [number, number, number] {
  const dir = controller.getLookDirection();
  const x = player.position.x + dir.x * 5;
  const z = player.position.z + dir.z * 5;
  let y = -1;
  for (let sy = 80; sy >= 1; sy--) {
    if (isSolid(world.getBlock(Math.floor(x), sy, Math.floor(z)))) { y = sy + 1; break; }
  }
  if (y < 0) y = Math.floor(player.position.y);
  return [x, y, z];
}

function spawnAnimalAt(type: "sheep" | "pig" | "cow") {
  const [x, y, z] = getSpawnPos();
  const animal = new Animal(type, world, x, y, z);
  sceneManager.scene.add(animal.group);
}

function spawnZombieAt() {
  const [x, y, z] = getSpawnPos();
  const zombie = new Zombie(world, x, y, z);
  zombies.push(zombie);
  sceneManager.scene.add(zombie.group);
}

function spawnRareAt(type: RareType) {
  const [x, y, z] = getSpawnPos();
  const rc = new RareCreature(type, world, x, y, z);
  rareCreatures.push(rc);
  sceneManager.scene.add(rc.group);
}

function spawnVillagerAt() {
  const [x, y, z] = getSpawnPos();
  const v = new Villager(world, x, y, z);
  villagers.push(v);
  sceneManager.scene.add(v.group);
}

// --- Game Loop ---
let lastTime = performance.now();
let placeCooldown = 0;

function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt <= 0 || dt > 0.5) return;

  if (isPaused) {
    input.resetFrame();
    sceneManager.render();
    return;
  }

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
  });

  // Update sun/moon/stars positions
  sceneManager.updateDayNight(dayTime, player.position);

  // Player hurt cooldown
  player.hurtCooldown -= dt;

  // Passive health regen when not recently hurt
  if (player.hurtCooldown <= -3 && player.health < player.maxHealth) {
    player.heal(1);
    player.hurtCooldown = -2; // reset regen timer
  }

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

  // Check if player is hiding (has a roof overhead = solid block within 4 blocks above)
  let playerHidden = false;
  for (let dy = 1; dy <= 4; dy++) {
    if (isSolid(world.getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y + PLAYER_HEIGHT) + dy,
      Math.floor(player.position.z)
    ))) {
      playerHidden = true;
      break;
    }
  }

  // Zombie spawning — ONLY at night
  zombieSpawnTimer -= dt;
  if (zombieSpawnTimer <= 0 && isNight && zombies.length < 10) {
    zombieSpawnTimer = 3 + Math.random() * 3;
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
    z.update(dt, player.position, playerHidden);

    // Remove dead zombies
    if (z.isDead && !z.group.visible) {
      sceneManager.scene.remove(z.group);
      zombies.splice(i, 1);
      continue;
    }

    // Despawn at dawn
    if (!isNight && !z.isDead) {
      sceneManager.scene.remove(z.group);
      zombies.splice(i, 1);
      continue;
    }

    // Zombie attacks player (only if not hidden)
    if (!z.isDead && !playerHidden) {
      const dx = z.position.x - player.position.x;
      const dz = z.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5 && z.canAttack()) {
        player.takeDamage(3);
        z.doAttack();
      }

      if (dist > 60) {
        sceneManager.scene.remove(z.group);
        zombies.splice(i, 1);
      }
    }
  }

  // Rare creature spawning — hostile ones only at night
  rareSpawnTimer -= dt;
  if (rareSpawnTimer <= 0 && rareCreatures.length < 3) {
    rareSpawnTimer = 30 + Math.random() * 30;
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 25;
    const rx = player.position.x + Math.cos(angle) * dist;
    const rz = player.position.z + Math.sin(angle) * dist;
    let ry = -1;
    for (let y = 80; y >= 1; y--) {
      if (isSolid(world.getBlock(Math.floor(rx), y, Math.floor(rz)))) { ry = y + 1; break; }
    }
    if (ry > 0) {
      // Hostile rares only at night, passive anytime
      const hostileTypes: RareType[] = ["trex", "dragon", "yeti"];
      const passiveTypes: RareType[] = ["bigfoot", "unicorn"];
      const pool = isNight ? ALL_RARE_TYPES : passiveTypes;
      const type = pool[Math.floor(Math.random() * pool.length)]!;
      const rc = new RareCreature(type, world, rx, ry, rz);
      rareCreatures.push(rc);
      sceneManager.scene.add(rc.group);
    }
  }

  // Update rare creatures
  for (let i = rareCreatures.length - 1; i >= 0; i--) {
    const rc = rareCreatures[i]!;
    rc.update(dt, player.position, playerHidden);

    if (rc.isDead && !rc.group.visible) {
      sceneManager.scene.remove(rc.group);
      rareCreatures.splice(i, 1);
      continue;
    }

    if (!rc.isDead) {
      const dx = rc.position.x - player.position.x;
      const dz = rc.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Attack
      if (dist < 2 && rc.canAttack()) {
        const dmg = rc.doAttack();
        player.takeDamage(dmg);
      }
      // Collision push
      if (dist < rc.radius && dist > 0.01) {
        const push = (rc.radius - dist) / dist;
        player.position.x -= dx * push;
        player.position.z -= dz * push;
      }
      // Despawn far
      if (dist > 80) {
        sceneManager.scene.remove(rc.group);
        rareCreatures.splice(i, 1);
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
        // Only cast if looking at water
        if (raycaster.lastWaterHit) {
          fishingGame.startFishing();
          controller.playerModel.triggerSwing();
          sound.playSplash();
        }
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

      // Check rare creatures
      let rareTarget: RareCreature | null = null;
      let rareDist = 3 * 3;
      for (const rc of rareCreatures) {
        if (rc.isDead) continue;
        const rdx = rc.position.x - attackPoint.x;
        const rdy = rc.position.y - attackPoint.y;
        const rdz = rc.position.z - attackPoint.z;
        const rd = rdx * rdx + rdy * rdy + rdz * rdz;
        if (rd < rareDist) { rareDist = rd; rareTarget = rc; }
      }

      if (rareTarget) {
        const wasDead = rareTarget.isDead;
        rareTarget.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
        if (!wasDead && rareTarget.isDead) {
          sound.playMonsterDeath();
          const drop = rollLoot(rareTarget.type);
          const lvl = player.addXP(drop.xp);
          loot.show(`+${drop.item}  +${drop.xp} XP` + (lvl ? "  LEVEL UP!" : ""), "#ff66ff");
        }
      } else if (zombieTarget) {
        const wasDead = zombieTarget.isDead;
        zombieTarget.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
        if (!wasDead && zombieTarget.isDead) {
          sound.playMonsterDeath();
          const drop = rollLoot("zombie");
          const lvl = player.addXP(drop.xp);
          loot.show(`+${drop.item}  +${drop.xp} XP` + (lvl ? "  LEVEL UP!" : ""), "#aaffaa");
        }
      } else if (target) {
        const wasDead = target.isDead;
        target.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        sound.playBlockBreak();
        if (!wasDead && target.isDead) {
          const drop = rollLoot(target.type);
          const lvl = player.addXP(drop.xp);
          loot.show(`+${drop.item}  +${drop.xp} XP` + (lvl ? "  LEVEL UP!" : ""), "#ffdd44");
        }
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

  // Place block: right-click OR B/E key
  const wantsPlace = input.rightClick || input.placeClick;
  if (wantsPlace) {
    let placeX: number, placeY: number, placeZ: number;

    if (raycaster.lastHit) {
      const [bx, by, bz] = raycaster.lastHit.blockPos;
      const [nx, ny, nz] = raycaster.lastHit.faceNormal;
      placeX = bx + nx;
      placeY = by + ny;
      placeZ = bz + nz;
    } else {
      // Fallback: place 2 blocks in front of player at eye level
      const dir = controller.getLookDirection();
      placeX = Math.floor(player.position.x + dir.x * 3);
      placeY = Math.floor(player.position.y + PLAYER_HEIGHT - 0.5 + dir.y * 3);
      placeZ = Math.floor(player.position.z + dir.z * 3);
    }

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

  // Boat spawning (in water)
  boatSpawnTimer -= dt;
  if (boatSpawnTimer <= 0 && boats.length < 5) {
    boatSpawnTimer = 15 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 30;
    const bx = player.position.x + Math.cos(angle) * dist;
    const bz = player.position.z + Math.sin(angle) * dist;
    // Find water
    for (let y = 60; y >= 1; y--) {
      if (world.getBlock(Math.floor(bx), y, Math.floor(bz)) === BlockId.WATER &&
          world.getBlock(Math.floor(bx), y + 1, Math.floor(bz)) === BlockId.AIR) {
        const boat = new Boat(world, bx, y + 0.9, bz);
        boats.push(boat);
        sceneManager.scene.add(boat.group);
        break;
      }
    }
  }

  // Update boats
  for (let i = boats.length - 1; i >= 0; i--) {
    const boat = boats[i]!;
    if (boat !== ridingBoat) {
      boat.update(dt);
    }
    // Despawn far boats
    const bdx = boat.position.x - player.position.x;
    const bdz = boat.position.z - player.position.z;
    if (bdx * bdx + bdz * bdz > 80 * 80 && boat !== ridingBoat) {
      sceneManager.scene.remove(boat.group);
      boats.splice(i, 1);
    }
  }

  // Boat riding: Enter/exit with X key handled in keydown
  if (ridingBoat) {
    let fwd = 0, turn = 0;
    if (input.isKeyDown("KeyW") || input.isKeyDown("ArrowUp")) fwd += 1;
    if (input.isKeyDown("KeyS") || input.isKeyDown("ArrowDown")) fwd -= 1;
    if (input.isKeyDown("KeyA") || input.isKeyDown("ArrowLeft")) turn += 1;
    if (input.isKeyDown("KeyD") || input.isKeyDown("ArrowRight")) turn -= 1;
    ridingBoat.steer(fwd, turn, dt);
    player.position.copy(ridingBoat.position);
    player.position.y += 0.5;
    player.yaw = ridingBoat.yaw;
  }

  // Drowning — player fully underwater loses health
  const headY = Math.floor(player.position.y + PLAYER_HEIGHT);
  const blockAtHead = world.getBlock(
    Math.floor(player.position.x), headY, Math.floor(player.position.z)
  );
  if (blockAtHead === BlockId.WATER && !ridingBoat) {
    player.takeDamage(1);
  }

  // Zombie ambient groans (when nearby)
  for (const z of zombies) {
    if (z.isDead) continue;
    const zdx = z.position.x - player.position.x;
    const zdz = z.position.z - player.position.z;
    if (zdx * zdx + zdz * zdz < 20 * 20 && Math.random() < dt * 0.1) {
      sound.playZombieGroan();
    }
  }

  // Rare creature roars (when nearby and hostile)
  for (const rc of rareCreatures) {
    if (rc.isDead) continue;
    const rdx = rc.position.x - player.position.x;
    const rdz = rc.position.z - player.position.z;
    if (rdx * rdx + rdz * rdz < 25 * 25 && Math.random() < dt * 0.05) {
      sound.playRoar();
    }
  }

  // Autosave every 30s
  saveManager.updateAutosave(dt, player, world, dayTime);

  hud.debugInfo.animals = animals.getAnimals().length;
  hud.debugInfo.fish = aquatics.getCreatures().length;
  hud.debugInfo.zombies = zombies.length;
  hud.dayTime = dayTime;
  hud.update(player, dt);
  input.resetFrame();
  sceneManager.render();
}

requestAnimationFrame(gameLoop);
