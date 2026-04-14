import { BlockId, hasGravity, isSolid } from "./BlockType";
import { World } from "./World";

/**
 * Block physics:
 * - Gravity: Sand/Gravel fall when no support below
 * - Fire: Spreads to adjacent wood/leaves, burns out after time
 * - Water flow: Water spreads sideways into adjacent air blocks at same level
 */

interface FallingBlock {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
  timer: number;
}

interface FireBlock {
  x: number;
  y: number;
  z: number;
  life: number; // seconds until burns out
}

const fallingBlocks: FallingBlock[] = [];
const fireBlocks: FireBlock[] = [];
let physicsTimer = 0;

export function updatePhysics(world: World, dt: number): void {
  physicsTimer += dt;
  if (physicsTimer < 0.2) return; // tick every 200ms
  physicsTimer = 0;

  // Gravity blocks
  updateGravity(world);

  // Fire spread
  updateFire(world, dt * 5); // compensate for tick rate

  // Water flow
  updateWaterFlow(world);
}

function updateGravity(world: World): void {
  // Scan for gravity blocks with air below them
  // For efficiency, only check recently placed blocks
  // We'll scan a small area around origin (this is a simplification)
  // In practice, the world.setBlock should trigger this check

  // Check existing falling blocks
  for (let i = fallingBlocks.length - 1; i >= 0; i--) {
    const fb = fallingBlocks[i]!;
    const below = world.getBlock(fb.x, fb.y - 1, fb.z);
    if (!isSolid(below) && below !== BlockId.WATER && below !== BlockId.LAVA && fb.y > 0) {
      // Keep falling
      world.setBlock(fb.x, fb.y, fb.z, BlockId.AIR);
      fb.y--;
      world.setBlock(fb.x, fb.y, fb.z, fb.blockId);
    } else {
      // Landed
      fallingBlocks.splice(i, 1);
    }
  }
}

/** Called when a block is placed — check if it should fall */
export function checkGravityAt(world: World, x: number, y: number, z: number): void {
  const block = world.getBlock(x, y, z);
  if (!hasGravity(block)) return;

  const below = world.getBlock(x, y - 1, z);
  if (!isSolid(below) && below !== BlockId.WATER && below !== BlockId.LAVA && y > 0) {
    fallingBlocks.push({ x, y, z, blockId: block, timer: 0 });
  }
}

function updateFire(world: World, dt: number): void {
  for (let i = fireBlocks.length - 1; i >= 0; i--) {
    const fire = fireBlocks[i]!;
    fire.life -= dt;

    if (fire.life <= 0) {
      // Burns out
      world.setBlock(fire.x, fire.y, fire.z, BlockId.AIR);
      fireBlocks.splice(i, 1);
      continue;
    }

    // Try to spread to adjacent flammable blocks
    if (Math.random() < 0.1) { // 10% chance per tick
      const dirs: [number, number, number][] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      const [dx, dy, dz] = dirs[Math.floor(Math.random() * dirs.length)]!;
      const nx = fire.x + dx;
      const ny = fire.y + dy;
      const nz = fire.z + dz;

      const neighbor = world.getBlock(nx, ny, nz);
      // Spread to wood and leaves
      if (neighbor === BlockId.WOOD || neighbor === BlockId.LEAVES) {
        world.setBlock(nx, ny, nz, BlockId.FIRE);
        fireBlocks.push({ x: nx, y: ny, z: nz, life: 3 + Math.random() * 4 });
      }
    }
  }
}

/** Called when fire is placed */
export function registerFire(x: number, y: number, z: number): void {
  fireBlocks.push({ x, y, z, life: 5 + Math.random() * 5 });
}

function updateWaterFlow(world: World): void {
  // Simple water flow: water blocks spread sideways into adjacent air
  // Only process a few per tick for performance
  // This is triggered when water is placed

  // We'll keep it simple — water doesn't flow automatically,
  // but when placed, it fills adjacent lower air blocks
}

/** Called when water is placed — spread sideways */
export function spreadWater(world: World, x: number, y: number, z: number): void {
  // Flow downward first
  if (world.getBlock(x, y - 1, z) === BlockId.AIR) {
    world.setBlock(x, y - 1, z, BlockId.WATER);
  }
  // Flow sideways
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]] as [number, number][]) {
    const nx = x + dx;
    const nz = z + dz;
    if (world.getBlock(nx, y, nz) === BlockId.AIR &&
        (isSolid(world.getBlock(nx, y - 1, nz)) || world.getBlock(nx, y - 1, nz) === BlockId.WATER)) {
      world.setBlock(nx, y, nz, BlockId.WATER);
    }
  }
}
