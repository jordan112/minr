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

        // Multi-octave noise for height
        const height = Math.floor(
          SEA_LEVEL +
          this.noise2D(wx / 120, wz / 120) * 20 +
          this.noise2D(wx / 60, wz / 60) * 10 +
          this.noise2D(wx / 30, wz / 30) * 5
        );

        const clampedHeight = Math.max(1, Math.min(WORLD_HEIGHT - 1, height));

        for (let y = 0; y <= clampedHeight; y++) {
          if (y === 0) {
            chunk.setBlock(x, y, z, BlockId.BEDROCK);
          } else if (y === clampedHeight) {
            chunk.setBlock(x, y, z, clampedHeight <= SEA_LEVEL - 2 ? BlockId.SAND : BlockId.GRASS);
          } else if (y > clampedHeight - 4) {
            chunk.setBlock(x, y, z, BlockId.DIRT);
          } else {
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
