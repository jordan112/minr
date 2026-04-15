import * as THREE from "three";
import { Animal } from "./Animal";
import type { AnimalType } from "./Animal";
import { World } from "../world/World";
import { BlockId } from "../world/BlockType";
import { CHUNK_SIZE } from "../utils/constants";

const MAX_ANIMALS = 30;
const SPAWN_RADIUS = 40; // blocks from player
const DESPAWN_RADIUS = 80;
const SPAWN_INTERVAL = 2; // seconds between spawn attempts

export class AnimalManager {
  private animals: Animal[] = [];
  private scene: THREE.Scene;
  private world: World;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    // Spawn new animals
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.animals.length < MAX_ANIMALS) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(playerX, playerZ);
    }

    // Update and despawn
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i]!;
      animal.update(dt);

      // Remove dead animals after death animation
      if (animal.isDead && !animal.group.visible) {
        this.scene.remove(animal.group);
        this.animals.splice(i, 1);
        continue;
      }

      // Despawn if too far
      const dx = animal.position.x - playerX;
      const dz = animal.position.z - playerZ;
      if (dx * dx + dz * dz > DESPAWN_RADIUS * DESPAWN_RADIUS) {
        this.scene.remove(animal.group);
        this.animals.splice(i, 1);
      }
    }
  }

  /** Get all living animals for collision/combat checks */
  getAnimals(): readonly Animal[] {
    return this.animals;
  }

  addAnimal(animal: Animal): void {
    this.animals.push(animal);
    this.scene.add(animal.group);
  }

  /** Find the nearest animal within range of a point */
  findNearestInRange(x: number, y: number, z: number, range: number): Animal | null {
    let nearest: Animal | null = null;
    let nearestDist = range * range;

    for (const animal of this.animals) {
      if (animal.isDead) continue;
      const dx = animal.position.x - x;
      const dy = animal.position.y - y;
      const dz = animal.position.z - z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = animal;
      }
    }
    return nearest;
  }

  private trySpawn(playerX: number, playerZ: number): void {
    // Pick random position near player
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_RADIUS * 0.5 + Math.random() * SPAWN_RADIUS * 0.5;
    const x = Math.floor(playerX + Math.cos(angle) * dist);
    const z = Math.floor(playerZ + Math.sin(angle) * dist);

    // Find surface
    let surfaceY = -1;
    for (let y = 100; y >= 1; y--) {
      if (this.world.getBlock(x, y, z) === BlockId.GRASS &&
          this.world.getBlock(x, y + 1, z) === BlockId.AIR &&
          this.world.getBlock(x, y + 2, z) === BlockId.AIR) {
        surfaceY = y + 1;
        break;
      }
    }
    if (surfaceY < 0) return;

    // Pick random animal type
    const types: AnimalType[] = ["sheep", "pig", "cow"];
    const type = types[Math.floor(Math.random() * types.length)]!;

    const animal = new Animal(type, this.world, x + 0.5, surfaceY, z + 0.5);
    this.animals.push(animal);
    this.scene.add(animal.group);
  }
}
