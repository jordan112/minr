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

        // Multi-octave noise for height — mostly flat with gentle rolls
        let baseHeight =
          SEA_LEVEL +
          this.noise2D(wx / 300, wz / 300) * 4 +
          this.noise2D(wx / 100, wz / 100) * 2 +
          this.noise2D(wx / 50, wz / 50) * 1;

        // Lake/pond carving — use separate noise to cut deeper depressions
        const lakeNoise = this.noise2D(wx / 60 + 500, wz / 60 + 500);
        if (lakeNoise < -0.3) {
          // Carve deeper — creates lakes 3-5 blocks deep
          const depth = (-lakeNoise - 0.3) * 12;
          baseHeight -= depth;
        }

        const height = Math.floor(baseHeight);

        const clampedHeight = Math.max(1, Math.min(WORLD_HEIGHT - 1, height));

        // Water level — at SEA_LEVEL so any dip creates ponds
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

    // Tree pass
    this.generateTrees(chunk, worldX, worldZ);
  }

  private generateTrees(chunk: Chunk, worldX: number, worldZ: number): void {
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx = worldX + x;
        const wz = worldZ + z;

        // Use noise to determine tree placement (deterministic)
        const treeVal = this.treeNoise(wx / 4, wz / 4);
        if (treeVal < 0.85) continue;

        // Find surface
        let surfaceY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          if (chunk.getBlock(x, y, z) === BlockId.GRASS) {
            surfaceY = y;
            break;
          }
        }
        if (surfaceY < 0) continue;

        const trunkHeight = 4 + Math.floor(Math.abs(this.treeNoise(wx, wz)) * 3);

        // Trunk
        for (let dy = 1; dy <= trunkHeight; dy++) {
          chunk.setBlock(x, surfaceY + dy, z, BlockId.WOOD);
        }

        // Leaves (sphere-ish)
        const leafStart = trunkHeight - 2;
        const leafTop = trunkHeight + 1;
        for (let dy = leafStart; dy <= leafTop; dy++) {
          const radius = dy === leafTop ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (dx === 0 && dz === 0 && dy < trunkHeight) continue; // trunk position
              const lx = x + dx;
              const lz = z + dz;
              const ly = surfaceY + dy;
              if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly >= WORLD_HEIGHT) continue;
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.6) continue;
              if (chunk.getBlock(lx, ly, lz) === BlockId.AIR) {
                chunk.setBlock(lx, ly, lz, BlockId.LEAVES);
              }
            }
          }
        }
      }
    }
  }
}
