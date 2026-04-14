import { createNoise2D } from "simplex-noise";
import { BlockId } from "./BlockType";
import { Chunk } from "./Chunk";
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from "../utils/constants";

export class TerrainGenerator {
  private noise2D: ReturnType<typeof createNoise2D>;
  private treeNoise: ReturnType<typeof createNoise2D>;

  constructor(seed?: number) {
    // simplex-noise uses a random function for seeding
    const rng = seed !== undefined ? this.seededRandom(seed) : Math.random;
    this.noise2D = createNoise2D(rng);
    this.treeNoise = createNoise2D(rng);
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  generate(chunk: Chunk): void {
    const worldX = chunk.chunkX * CHUNK_SIZE;
    const worldZ = chunk.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        // Multi-octave noise for height — mostly flat, sits ABOVE water
        let baseHeight =
          SEA_LEVEL + 2 +
          this.noise2D(wx / 300, wz / 300) * 3 +
          this.noise2D(wx / 100, wz / 100) * 2 +
          this.noise2D(wx / 50, wz / 50) * 1;

        // Lakes — carve ponds into terrain using a separate noise layer
        // Scale 30 = smallish ponds, threshold -0.35 = moderate frequency
        const lakeNoise = this.noise2D(wx / 30 + 500, wz / 30 + 500);
        if (lakeNoise < -0.35) {
          const depth = (-lakeNoise - 0.35) * 10;
          baseHeight -= depth;
        }

        const height = Math.floor(baseHeight);

        const clampedHeight = Math.max(1, Math.min(WORLD_HEIGHT - 1, height));

        // Water fills only below sea level — most terrain is above this
        const waterLevel = SEA_LEVEL;

        for (let y = 0; y <= Math.max(clampedHeight, waterLevel); y++) {
          if (y === 0) {
            chunk.setBlock(x, y, z, BlockId.BEDROCK);
          } else if (y > clampedHeight && y <= waterLevel) {
            // Water fills depressions
            chunk.setBlock(x, y, z, BlockId.WATER);
          } else if (y === clampedHeight && clampedHeight <= waterLevel) {
            // Sand at bottom of water and shoreline
            chunk.setBlock(x, y, z, BlockId.SAND);
          } else if (y === clampedHeight && clampedHeight <= waterLevel + 1) {
            // Sand at shoreline
            chunk.setBlock(x, y, z, BlockId.SAND);
          } else if (y === clampedHeight) {
            chunk.setBlock(x, y, z, BlockId.GRASS);
          } else if (y > clampedHeight - 4 && y < clampedHeight) {
            chunk.setBlock(x, y, z, BlockId.DIRT);
          } else if (y <= clampedHeight) {
            chunk.setBlock(x, y, z, BlockId.STONE);
          }
        }
      }
    }

    // Lava pools (rare, small)
    this.generateLava(chunk, worldX, worldZ);

    // Tree pass
    this.generateTrees(chunk, worldX, worldZ);
  }

  private generateTrees(chunk: Chunk, worldX: number, worldZ: number): void {
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        const treeVal = this.treeNoise(wx / 4, wz / 4);
        if (treeVal < 0.85) continue;

        let surfaceY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          if (chunk.getBlock(x, y, z) === BlockId.GRASS) {
            surfaceY = y;
            break;
          }
        }
        if (surfaceY < 0) continue;

        // Tree variety based on noise
        const treeType = Math.abs(this.treeNoise(wx * 3, wz * 3));
        // 0.0-0.3 = tall narrow (spruce), 0.3-0.6 = standard oak, 0.6-1.0 = short wide (fruit tree)

        if (treeType < 0.3) {
          // Tall narrow spruce
          const trunkHeight = 6 + Math.floor(treeType * 10);
          for (let dy = 1; dy <= trunkHeight; dy++) {
            chunk.setBlock(x, surfaceY + dy, z, BlockId.WOOD);
          }
          // Cone-shaped leaves
          for (let dy = 3; dy <= trunkHeight + 1; dy++) {
            const radius = Math.max(0, Math.min(2, trunkHeight + 1 - dy));
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (dx === 0 && dz === 0 && dy <= trunkHeight) continue;
                const lx = x + dx, lz = z + dz, ly = surfaceY + dy;
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly >= WORLD_HEIGHT) continue;
                if (chunk.getBlock(lx, ly, lz) === BlockId.AIR) {
                  chunk.setBlock(lx, ly, lz, BlockId.LEAVES);
                }
              }
            }
          }
        } else if (treeType < 0.6) {
          // Standard oak
          const trunkHeight = 4 + Math.floor(Math.abs(this.treeNoise(wx, wz)) * 3);
          for (let dy = 1; dy <= trunkHeight; dy++) {
            chunk.setBlock(x, surfaceY + dy, z, BlockId.WOOD);
          }
          const leafStart = trunkHeight - 2;
          const leafTop = trunkHeight + 1;
          for (let dy = leafStart; dy <= leafTop; dy++) {
            const radius = dy === leafTop ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (dx === 0 && dz === 0 && dy < trunkHeight) continue;
                const lx = x + dx, lz = z + dz, ly = surfaceY + dy;
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly >= WORLD_HEIGHT) continue;
                if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.6) continue;
                if (chunk.getBlock(lx, ly, lz) === BlockId.AIR) {
                  chunk.setBlock(lx, ly, lz, BlockId.LEAVES);
                }
              }
            }
          }
        } else {
          // Short wide fruit tree — shorter trunk, wider canopy
          const trunkHeight = 3;
          for (let dy = 1; dy <= trunkHeight; dy++) {
            chunk.setBlock(x, surfaceY + dy, z, BlockId.WOOD);
          }
          // Wide canopy with "fruit" (torch blocks as colorful dots)
          for (let dy = trunkHeight - 1; dy <= trunkHeight + 2; dy++) {
            const radius = dy === trunkHeight + 2 ? 1 : 3;
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dz = -radius; dz <= radius; dz++) {
                if (dx === 0 && dz === 0 && dy <= trunkHeight) continue;
                const lx = x + dx, lz = z + dz, ly = surfaceY + dy;
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly >= WORLD_HEIGHT) continue;
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
                if (chunk.getBlock(lx, ly, lz) === BlockId.AIR) {
                  // Occasionally place "fruit" (torch = yellow dot) among leaves
                  const isFruit = Math.abs(dx) > 1 && Math.abs(dz) > 1 && Math.random() < 0.3 && dy < trunkHeight + 2;
                  chunk.setBlock(lx, ly, lz, isFruit ? BlockId.TORCH : BlockId.LEAVES);
                }
              }
            }
          }
        }
      }
    }
  }

  private generateLava(chunk: Chunk, worldX: number, worldZ: number): void {
    // Very rare lava pools — only in rocky/stone areas
    for (let x = 3; x < CHUNK_SIZE - 3; x++) {
      for (let z = 3; z < CHUNK_SIZE - 3; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        // Two noise checks: one for rarity, one for "rocky area"
        const lavaNoise = this.noise2D(wx / 15 + 1000, wz / 15 + 1000);
        if (lavaNoise < 0.92) continue; // very rare — only ~4% of noise peaks

        // Find surface — only place on stone (rocky areas)
        for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
          const block = chunk.getBlock(x, y, z);
          if (block === BlockId.STONE) {
            // Surrounded by stone = rocky area, place lava
            chunk.setBlock(x, y, z, BlockId.LAVA);
            break;
          }
          // If we hit grass or dirt first, skip — not rocky enough
          if (block === BlockId.GRASS || block === BlockId.DIRT || block === BlockId.SAND) {
            break;
          }
        }
      }
    }
  }
}
