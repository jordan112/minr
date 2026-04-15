import { BlockId } from "./BlockType";
import type { World } from "./World";

/**
 * Redstone-lite logic system.
 *
 * How to use:
 * 1. Place a LEVER (power source)
 * 2. Place WIRE blocks to carry the signal (up to 15 blocks)
 * 3. Connect to LAMP (lights up) or DOOR (becomes passable)
 * 4. Left-click the LEVER to toggle power ON/OFF
 *
 * Power rules:
 * - Lever ON = emits power 15
 * - Wire carries power, loses 1 per block
 * - Lamp glows when power > 0
 * - Door becomes non-solid when power > 0
 * - Power propagates through all 6 directions (up/down/left/right/front/back)
 */

const leverStates = new Map<string, boolean>();
const powerLevels = new Map<string, number>();
const poweredSet = new Set<string>();

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function toggleLever(world: World, x: number, y: number, z: number): boolean {
  const k = key(x, y, z);
  const newState = !(leverStates.get(k) ?? false);
  leverStates.set(k, newState);
  propagateAll(world);
  return newState;
}

export function isLeverOn(x: number, y: number, z: number): boolean {
  return leverStates.get(key(x, y, z)) ?? false;
}

export function isPowered(x: number, y: number, z: number): boolean {
  return poweredSet.has(key(x, y, z));
}

export function getPowerLevel(x: number, y: number, z: number): number {
  return powerLevels.get(key(x, y, z)) ?? 0;
}

/** Check if a door is currently open (powered) */
export function isDoorOpen(x: number, y: number, z: number): boolean {
  return isPowered(x, y, z);
}

const DIRS: [number, number, number][] = [
  [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1],
];

/** Full re-propagation from all known levers */
export function propagateAll(world: World): void {
  powerLevels.clear();
  poweredSet.clear();

  // Collect all active power sources
  const queue: [number, number, number, number][] = [];

  for (const [k, isOn] of leverStates) {
    if (!isOn) continue;
    const parts = k.split(",");
    const sx = Number(parts[0]);
    const sy = Number(parts[1]);
    const sz = Number(parts[2]);
    powerLevels.set(k, 15);
    poweredSet.add(k);
    queue.push([sx, sy, sz, 15]);
  }

  // BFS power propagation
  while (queue.length > 0) {
    const [cx, cy, cz, power] = queue.shift()!;

    for (const [dx, dy, dz] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nz = cz + dz;
      const nk = key(nx, ny, nz);
      const newPower = power - 1;
      if (newPower <= 0) continue;

      const block = world.getBlock(nx, ny, nz);

      // Wire propagates power
      if (block === BlockId.WIRE) {
        if (newPower > (powerLevels.get(nk) ?? 0)) {
          powerLevels.set(nk, newPower);
          poweredSet.add(nk);
          queue.push([nx, ny, nz, newPower]);
        }
      }

      // Lamp and Door receive power but don't propagate
      if (block === BlockId.LAMP || block === BlockId.DOOR) {
        if (newPower > (powerLevels.get(nk) ?? 0)) {
          powerLevels.set(nk, newPower);
          poweredSet.add(nk);
        }
      }
    }
  }
}

/** Call when a redstone block is placed or removed to re-propagate */
export function propagatePower(world: World, _x: number, _y: number, _z: number): void {
  propagateAll(world);
}

/**
 * Visual update — returns list of powered lamps for lighting.
 * Can be used to add point lights at powered lamp positions.
 */
export function getPoweredLamps(): [number, number, number][] {
  const lamps: [number, number, number][] = [];
  for (const k of poweredSet) {
    const parts = k.split(",");
    lamps.push([Number(parts[0]), Number(parts[1]), Number(parts[2])]);
  }
  return lamps;
}
