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
import { PLAYER_HEIGHT, SEA_LEVEL } from "./utils/constants";
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
import { MountainGoat } from "./entities/MountainGoat";
import { LootPopup, rollLoot } from "./ui/LootPopup";
import { Boat } from "./entities/Boat";
import { SaveManager } from "./save/SaveManager";
import { toggleLever, propagatePower, isPowered, getPoweredLamps } from "./world/RedstoneSystem";
import { updatePhysics, checkGravityAt, registerFire, spreadWater } from "./world/PhysicsSystem";
import { hasGravity } from "./world/BlockType";

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

// Ghost preview block for building — wireframe + transparent fill
const ghostGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const ghostMat = new THREE.MeshBasicMaterial({
  color: 0x44ff44,
  transparent: true,
  opacity: 0.3,
});
const ghostBlock = new THREE.Mesh(ghostGeo, ghostMat);
// Add wireframe edges
const ghostEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(ghostGeo),
  new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 })
);
ghostBlock.add(ghostEdges);
ghostBlock.visible = false;
ghostBlock.renderOrder = 2;
sceneManager.scene.add(ghostBlock);
const saveManager = new SaveManager();

// Break particle effect
const breakParticles: {mesh: THREE.Mesh, vel: THREE.Vector3, life: number}[] = [];
function spawnBreakParticles(x: number, y: number, z: number) {
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 5 + 2,
      (Math.random() - 0.5) * 4
    );
    sceneManager.scene.add(mesh);
    breakParticles.push({ mesh, vel, life: 1.0 });
  }
}

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
const DAY_LENGTH = 1200; // 20 minutes full cycle (Minecraft standard)
let isPaused = false;
let playerAir = 10;
let airTimer = 0;

// Rare creatures
const rareCreatures: RareCreature[] = [];
let rareSpawnTimer = 30;

// Mountain goats
const mountainGoats: MountainGoat[] = [];
let goatSpawnTimer = 10;

// Boats
const boats: Boat[] = [];
let boatSpawnTimer = 5;
let ridingBoat: Boat | null = null;

// Auto-load saved game if exists
const savedGame = saveManager.load();
if (savedGame) {
  dayTime = saveManager.applyLoad(savedGame, player, world);
}

fishingGame.setScene(sceneManager.scene, player);
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
  controller.setFPTool(tool);
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
    controller.setFPTool(currentTool);
    hud.setTool(currentTool);
  }

  // Q to cycle tools backward
  if (e.code === "KeyQ") {
    const idx = ALL_TOOLS.indexOf(currentTool);
    currentTool = ALL_TOOLS[(idx - 1 + ALL_TOOLS.length) % ALL_TOOLS.length]!;
    controller.playerModel.setTool(currentTool);
    controller.setFPTool(currentTool);
    hud.setTool(currentTool);
  }

  // Number keys for block selection
  // 1-9 select blocks, 0 selects block 10
  if (num >= 1 && num <= 9 && num <= PLACEABLE_BLOCKS.length) {
    player.selectedBlockIndex = num - 1;
  }
  if (e.key === "0" && PLACEABLE_BLOCKS.length >= 10) {
    player.selectedBlockIndex = 9;
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
    controller.setFPTool(currentTool);
    hud.setTool(currentTool);
  }

  // C to cast fishing line (when holding rod — requires water nearby)
  if (e.code === "KeyC" && currentTool === ToolType.FISHING_ROD && fishingGame.state === "idle") {
    const dir = controller.getLookDirection();
    const castX = player.position.x + dir.x * 5;
    const castZ = player.position.z + dir.z * 5;
    let foundWater = false;
    let castY = player.position.y;
    for (let y = Math.floor(player.position.y) + 3; y >= Math.floor(player.position.y) - 5; y--) {
      if (world.getBlock(Math.floor(castX), y, Math.floor(castZ)) === BlockId.WATER) {
        castY = y + 0.5;
        foundWater = true;
        break;
      }
    }
    if (foundWater) {
      fishingGame.setCastPosition(new THREE.Vector3(castX, castY, castZ));
      fishingGame.startFishing();
      controller.playerModel.triggerSwing();
      controller.triggerFPSwing();
      sound.playSplash();
    }
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
    { label: "MSU Spartan", fn: () => spawnRareAt("spartan") },
    { label: "Hokie Bird", fn: () => spawnRareAt("hokiebird") },
    { label: "Mtn Goat", fn: () => { const [x,y,z] = getSpawnPos(); const g = new MountainGoat(world,x,y,z); mountainGoats.push(g); sceneManager.scene.add(g.group); } },
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
  animals.addAnimal(animal); // register with manager so they can be attacked
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

  // Update systems — skip normal movement when in boat
  if (ridingBoat) {
    // Only update mouse look, not movement/gravity
    controller.updateCameraOnly(dt);
  } else {
    controller.update(dt);
  }
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

    // Zombie attacks player (only if not hidden, only at night)
    if (!z.isDead && !playerHidden && isNight) {
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
      const block = world.getBlock(Math.floor(rx), y, Math.floor(rz));
      if (block === BlockId.WATER || block === BlockId.LAVA) { ry = -1; break; } // skip water
      if (isSolid(block)) { ry = y + 1; break; }
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
      // Attack (only at night)
      if (dist < 2 && rc.canAttack() && isNight) {
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

  // Left click: fishing, attack, or break — NEVER place
  // Skip if B/E was pressed this frame (user wants to place, not break)
  if (input.leftClick && !input.placeClick) {
    if (currentTool === ToolType.FISHING_ROD) {
      // Fishing rod: cast or interact with mini-game
      if (fishingGame.state === "idle") {
        // Only cast if looking at water
        if (raycaster.lastWaterHit) {
          const [wx, wy, wz] = raycaster.lastWaterHit.blockPos;
          fishingGame.setCastPosition(new THREE.Vector3(wx + 0.5, wy + 0.5, wz + 0.5));
          fishingGame.startFishing();
          controller.playerModel.triggerSwing();
        controller.triggerFPSwing();
          sound.playSplash();
        }
      } else if (fishingGame.state === "bite" || fishingGame.state === "reeling") {
        fishingGame.onClick();
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
        controller.triggerFPSwing();
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
        controller.triggerFPSwing();
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
        controller.triggerFPSwing();
        sound.playBlockBreak();
        if (!wasDead && target.isDead) {
          const drop = rollLoot(target.type);
          const lvl = player.addXP(drop.xp);
          loot.show(`+${drop.item}  +${drop.xp} XP` + (lvl ? "  LEVEL UP!" : ""), "#ffdd44");
        }
      } else if (aquaticTarget) {
        aquaticTarget.takeDamage(toolDef.damage);
        controller.playerModel.triggerSwing();
        controller.triggerFPSwing();
        sound.playBlockBreak();
      } else if (raycaster.lastHit) {
        const [bx, by, bz] = raycaster.lastHit.blockPos;
        const hitBlock = world.getBlock(bx, by, bz);

        if (hitBlock === BlockId.LEVER) {
          // Left-click breaks lever (use B/right-click to toggle)
          spawnBreakParticles(bx, by, bz);
          world.setBlock(bx, by, bz, BlockId.AIR);
          propagatePower(world, bx, by, bz);
          sound.playBlockBreak();
          controller.playerModel.triggerSwing();
          controller.triggerFPSwing();
        } else if (hitBlock === BlockId.TNT) {
          // TNT EXPLOSION! Destroy blocks in a radius
          sound.playExplosion();
          const radius = 4;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (dx*dx + dy*dy + dz*dz <= radius*radius) {
                  const block = world.getBlock(bx+dx, by+dy, bz+dz);
                  if (block !== BlockId.BEDROCK) {
                    world.setBlock(bx+dx, by+dy, bz+dz, BlockId.AIR);
                  }
                }
              }
            }
          }
        } else {
          const brokenBlock = world.getBlock(bx, by, bz);
          spawnBreakParticles(bx, by, bz);
          world.setBlock(bx, by, bz, BlockId.AIR);
          // Re-propagate redstone if a circuit block was broken
          if (brokenBlock === BlockId.WIRE || brokenBlock === BlockId.LAMP || brokenBlock === BlockId.DOOR) {
            propagatePower(world, bx, by, bz);
          }
          // Check if blocks above should fall (gravity)
          for (let gy = by + 1; gy < by + 10; gy++) {
            checkGravityAt(world, bx, gy, bz);
          }
        }
        controller.playerModel.triggerSwing();
        controller.triggerFPSwing();
        sound.playBlockBreak();
      }
    }
  }

  // Cancel fishing if tool changes
  if (currentTool !== ToolType.FISHING_ROD && fishingGame.state !== "idle") {
    fishingGame.cancelFishing();
  }

  // Calculate where a block would be placed
  let placeX = 0, placeY = 0, placeZ = 0;
  let hasPlaceTarget = false;

  if (raycaster.lastHit) {
    // Place adjacent to the block face we're looking at
    const [bx, by, bz] = raycaster.lastHit.blockPos;
    const [nx, ny, nz] = raycaster.lastHit.faceNormal;
    placeX = bx + nx;
    placeY = by + ny;
    placeZ = bz + nz;
    hasPlaceTarget = true;
  } else {
    // Fallback: place 3 blocks in front of player, snapped to ground
    const dir = controller.getLookDirection();
    placeX = Math.floor(player.position.x + dir.x * 3);
    placeZ = Math.floor(player.position.z + dir.z * 3);
    // Find the ground at that position
    placeY = Math.floor(player.position.y);
    for (let y = placeY + 3; y >= placeY - 3; y--) {
      if (isSolid(world.getBlock(placeX, y, placeZ)) && !isSolid(world.getBlock(placeX, y + 1, placeZ))) {
        placeY = y + 1;
        hasPlaceTarget = true;
        break;
      }
    }
    // If still no ground, just place at look height
    if (!hasPlaceTarget) {
      placeY = Math.floor(player.position.y + PLAYER_HEIGHT * 0.5 + dir.y * 3);
      hasPlaceTarget = true;
    }
  }

  // Ghost preview block
  ghostBlock.position.set(placeX + 0.5, placeY + 0.5, placeZ + 0.5);
  ghostBlock.visible = false;

  // Toggle lever with B/right-click (if aiming at a lever)
  const wantsPlace = input.rightClick || input.placeClick;
  if (wantsPlace && raycaster.lastHit) {
    const [lbx, lby, lbz] = raycaster.lastHit.blockPos;
    if (world.getBlock(lbx, lby, lbz) === BlockId.LEVER) {
      toggleLever(world, lbx, lby, lbz);
      sound.playBlockPlace();
      controller.playerModel.triggerSwing();
      controller.triggerFPSwing();
    }
  }

  // Place block: B/E key or right-click
  if (wantsPlace && hasPlaceTarget) {
    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;
    const playerOverlaps =
      placeX >= Math.floor(px - 0.3) && placeX <= Math.floor(px + 0.3) &&
      placeZ >= Math.floor(pz - 0.3) && placeZ <= Math.floor(pz + 0.3) &&
      placeY >= Math.floor(py) && placeY <= Math.floor(py + PLAYER_HEIGHT);

    if (!playerOverlaps && !isSolid(world.getBlock(placeX, placeY, placeZ))) {
      const blockToPlace = PLACEABLE_BLOCKS[player.selectedBlockIndex]!;
      world.setBlock(placeX, placeY, placeZ, blockToPlace);
      sound.playBlockPlace();

      // Handle special block placement
      if (hasGravity(blockToPlace)) {
        checkGravityAt(world, placeX, placeY, placeZ);
      }
      if (blockToPlace === BlockId.FIRE) {
        registerFire(placeX, placeY, placeZ);
      }
      if (blockToPlace === BlockId.WATER) {
        spreadWater(world, placeX, placeY, placeZ);
      }
      if (blockToPlace === BlockId.WIRE || blockToPlace === BlockId.LAMP || blockToPlace === BlockId.DOOR) {
        propagatePower(world, placeX, placeY, placeZ);
      }
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

    // Player sits ON TOP of the boat, not sinking
    player.position.x = ridingBoat.position.x;
    player.position.z = ridingBoat.position.z;
    player.position.y = ridingBoat.position.y + 0.3;
    player.velocity.set(0, 0, 0);
    player.isGrounded = true;

    // Rowing animation when moving
    const isRowing = fwd !== 0 || turn !== 0;
    if (isRowing) {
      controller.playerModel.triggerSwing();
        controller.triggerFPSwing();
    }
  }

  // Drowning — air bubble system
  const headY = Math.floor(player.position.y + PLAYER_HEIGHT);
  const blockAtHead = world.getBlock(
    Math.floor(player.position.x), headY, Math.floor(player.position.z)
  );
  if (blockAtHead === BlockId.WATER && !ridingBoat) {
    airTimer += dt;
    if (airTimer >= 1) {
      airTimer -= 1;
      if (playerAir > 0) {
        playerAir--;
      } else {
        player.takeDamage(2);
      }
    }
  } else {
    // Restore air when not underwater
    airTimer += dt;
    if (airTimer >= 1 / 3) {
      airTimer -= 1 / 3;
      if (playerAir < 10) {
        playerAir = Math.min(10, playerAir + 1);
      }
    }
    if (playerAir >= 10) {
      airTimer = 0;
    }
  }
  hud.airBubbles = playerAir;

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

  // Mountain goat spawning (on high terrain)
  goatSpawnTimer -= dt;
  if (goatSpawnTimer <= 0 && mountainGoats.length < 5) {
    goatSpawnTimer = 12 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 25;
    const gx = player.position.x + Math.cos(angle) * dist;
    const gz = player.position.z + Math.sin(angle) * dist;
    for (let y = 80; y >= 1; y--) {
      const block = world.getBlock(Math.floor(gx), y, Math.floor(gz));
      if (block === BlockId.SAND || block === BlockId.STONE || block === BlockId.GRASS) {
        // Only spawn on higher terrain
        if (y > SEA_LEVEL + 3) {
          const goat = new MountainGoat(world, gx, y + 1, gz);
          mountainGoats.push(goat);
          sceneManager.scene.add(goat.group);
        }
        break;
      }
    }
  }

  // Update mountain goats
  for (let i = mountainGoats.length - 1; i >= 0; i--) {
    const g = mountainGoats[i]!;
    g.update(dt);
    if (g.isDead && !g.group.visible) {
      sceneManager.scene.remove(g.group);
      mountainGoats.splice(i, 1);
      continue;
    }
    const dx = g.position.x - player.position.x;
    const dz = g.position.z - player.position.z;
    if (dx * dx + dz * dz > 70 * 70) {
      sceneManager.scene.remove(g.group);
      mountainGoats.splice(i, 1);
    }
  }

  // Whale blowhole sounds
  for (const ac of aquatics.getCreatures()) {
    if (ac.type === "whale" && ac.wantsBlowSound) {
      ac.wantsBlowSound = false;
      const dx = ac.position.x - player.position.x;
      const dz = ac.position.z - player.position.z;
      if (dx * dx + dz * dz < 40 * 40) {
        sound.playWhaleBlow();
      }
    }
  }

  // Redstone: update lamp lights
  // Remove old lamp lights
  for (let i = sceneManager.scene.children.length - 1; i >= 0; i--) {
    const child = sceneManager.scene.children[i];
    if (child && child.userData.isLampLight) {
      sceneManager.scene.remove(child);
    }
  }
  // Add point lights at powered lamps
  const poweredLamps = getPoweredLamps();
  for (const [lx, ly, lz] of poweredLamps) {
    const block = world.getBlock(lx, ly, lz);
    if (block === BlockId.LAMP) {
      const light = new THREE.PointLight(0xffffaa, 1.5, 12);
      light.position.set(lx + 0.5, ly + 0.5, lz + 0.5);
      light.userData.isLampLight = true;
      sceneManager.scene.add(light);
    }
  }

  // Physics tick (gravity, fire, water flow)
  updatePhysics(world, dt);

  // Autosave every 30s
  saveManager.updateAutosave(dt, player, world, dayTime);

  // Scroll wheel block selection
  if (input.scrollDelta !== 0) {
    const len = PLACEABLE_BLOCKS.length;
    player.selectedBlockIndex = ((player.selectedBlockIndex + input.scrollDelta) % len + len) % len;
  }

  hud.fishCaughtCount = fishingGame.totalCaught;
  hud.debugInfo.animals = animals.getAnimals().length;
  hud.debugInfo.fish = aquatics.getCreatures().length;
  hud.debugInfo.zombies = zombies.length;
  hud.dayTime = dayTime;
  hud.update(player, dt);
  // Update break particles
  for (let i = breakParticles.length - 1; i >= 0; i--) {
    const p = breakParticles[i]!;
    p.vel.y -= 15 * dt;
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.mesh.rotation.x += dt * 5;
    p.mesh.rotation.z += dt * 3;
    p.life -= dt;
    if (p.life <= 0) {
      sceneManager.scene.remove(p.mesh);
      breakParticles.splice(i, 1);
    }
  }

  input.resetFrame();
  sceneManager.render();
}

requestAnimationFrame(gameLoop);
