import * as THREE from "three";
import { BlockId } from "./BlockType";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../utils/constants";

export class Chunk {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;
  isDirty = true;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  }

  private index(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) {
      return BlockId.AIR;
    }
    return this.blocks[this.index(x, y, z)] as BlockId;
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[this.index(x, y, z)] = id;
    this.isDirty = true;
  }
}
