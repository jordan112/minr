import { BlockId, getBlockDef } from "./BlockType";
import { World } from "./World";

/**
 * Redstone-lite: simple power propagation system.
 *
 * Components:
 * - LEVER: toggleable power source (power 15 when ON)
 * - WIRE: carries power, decreases by 1 per block
 * - LAMP: glows when receiving power > 0
 * - DOOR: becomes passable when receiving power > 0
 *
 * Power propagates through adjacent wire blocks (6 directions).
 * Levers toggle on right-click/B/E.
 */

// Track lever states and power levels
const leverStates = new Map<string, boolean>(); // "x,y,z" -> on/off
const powerLevels = new Map<string, number>();   // "x,y,z" -> power level 0-15

// Track powered lamp/door states for rendering
const poweredBlocks = new Set<string>();

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function toggleLever(world: World, x: number, y: number, z: number): void {
  const k = key(x, y, z);
  const wasOn = leverStates.get(k) ?? false;
  leverStates.set(k, !wasOn);
  propagatePower(world, x, y, z);
}

export function isLeverOn(x: number, y: number, z: number): boolean {
  return leverStates.get(key(x, y, z)) ?? false;
}

export function isPowered(x: number, y: number, z: number): boolean {
  return poweredBlocks.has(key(x, y, z));
}

export function getPowerLevel(x: number, y: number, z: number): number {
  return powerLevels.get(key(x, y, z)) ?? 0;
}

const DIRS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export function propagatePower(world: World, sourceX: number, sourceY: number, sourceZ: number): void {
  // Clear old power levels
  powerLevels.clear();
  poweredBlocks.clear();

  // Find all levers that are ON and start BFS from each
  // We need to scan loaded chunks for levers — but for efficiency,
  // just re-propagate from all known levers
  const sources: [number, number, number, number][] = []; // x,y,z,power

  for (const [k, isOn] of leverStates) {
    if (!isOn) continue;
    const [sx, sy, sz] = k.split(",").map(Number) as [number, number, number];
    sources.push([sx, sy, sz, 15]);
  }

  // BFS propagation
  const queue = [...sources];
  for (const [sx, sy, sz, power] of sources) {
    powerLevels.set(key(sx, sy, sz), power);
  }

  while (queue.length > 0) {
    const [cx, cy, cz, cPower] = queue.shift()!;

    for (const [dx, dy, dz] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nz = cz + dz;
      const nk = key(nx, ny, nz);

      const block = world.getBlock(nx, ny, nz);
      const newPower = cPower - 1;

      if (newPower <= 0) continue;

      // Wire carries power
      if (block === BlockId.WIRE) {
        const existing = powerLevels.get(nk) ?? 0;
        if (newPower > existing) {
          powerLevels.set(nk, newPower);
          poweredBlocks.add(nk);
          queue.push([nx, ny, nz, newPower]);
        }
      }

      // Lamp and Door receive power (don't propagate further)
      if (block === BlockId.LAMP || block === BlockId.DOOR) {
        const existing = powerLevels.get(nk) ?? 0;
        if (newPower > existing) {
          powerLevels.set(nk, newPower);
          poweredBlocks.add(nk);
        }
      }
    }
  }
}

/**
 * Update redstone visuals — call each frame.
 * Changes wire color based on power, toggles lamp glow, door passability.
 */
export function updateRedstoneVisuals(world: World): void {
  // This is handled by the rendering system checking isPowered()
  // The mesher could use power levels to tint wire blocks,
  // but for simplicity we'll use point lights for powered lamps
}
