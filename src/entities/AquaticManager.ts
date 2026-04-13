import * as THREE from "three";
import { AquaticCreature } from "./AquaticCreature";
import type { AquaticType } from "./AquaticCreature";
import { World } from "../world/World";
import { BlockId } from "../world/BlockType";

const MAX_AQUATIC = 25;
const SPAWN_RADIUS = 40;
const DESPAWN_RADIUS = 70;
const SPAWN_INTERVAL = 1; // try every second

export class AquaticManager {
  private creatures: AquaticCreature[] = [];
  private scene: THREE.Scene;
  private world: World;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < MAX_AQUATIC) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(playerX, playerZ);
    }

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i]!;
      creature.update(dt);

      if (creature.isDead && !creature.group.visible) {
        this.scene.remove(creature.group);
        this.creatures.splice(i, 1);
        continue;
      }

      const dx = creature.position.x - playerX;
      const dz = creature.position.z - playerZ;
      if (dx * dx + dz * dz > DESPAWN_RADIUS * DESPAWN_RADIUS) {
        this.scene.remove(creature.group);
        this.creatures.splice(i, 1);
      }
    }
  }

  getCreatures(): readonly AquaticCreature[] {
    return this.creatures;
  }

  findNearestInRange(x: number, y: number, z: number, range: number): AquaticCreature | null {
    let nearest: AquaticCreature | null = null;
    let nearestDist = range * range;

    for (const creature of this.creatures) {
      if (creature.isDead) continue;
      const dx = creature.position.x - x;
      const dy = creature.position.y - y;
      const dz = creature.position.z - z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = creature;
      }
    }
    return nearest;
  }

  private trySpawn(playerX: number, playerZ: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_RADIUS * 0.4 + Math.random() * SPAWN_RADIUS * 0.6;
    const x = Math.floor(playerX + Math.cos(angle) * dist);
    const z = Math.floor(playerZ + Math.sin(angle) * dist);

    // Find water at this location
    let waterY = -1;
    for (let y = 80; y >= 1; y--) {
      if (this.world.getBlock(x, y, z) === BlockId.WATER) {
        waterY = y;
        break;
      }
    }
    if (waterY < 0) return;

    // Check there's enough water (at least 2 blocks deep for shark/squid)
    const waterDepth = this.getWaterDepth(x, waterY, z);

    // Pick type based on rarity and water depth
    let type: AquaticType;
    const roll = Math.random();
    if (roll < 0.03 && waterDepth >= 3) {
      type = "squid"; // 3% chance, needs deep water
    } else if (roll < 0.15 && waterDepth >= 2) {
      type = "shark"; // 12% chance, needs some depth
    } else {
      type = "fish"; // 85% chance
    }

    const creature = new AquaticCreature(type, this.world, x + 0.5, waterY, z + 0.5);
    this.creatures.push(creature);
    this.scene.add(creature.group);
  }

  private getWaterDepth(x: number, surfaceY: number, z: number): number {
    let depth = 0;
    for (let y = surfaceY; y >= 0; y--) {
      if (this.world.getBlock(x, y, z) === BlockId.WATER) {
        depth++;
      } else {
        break;
      }
    }
    return depth;
  }
}
