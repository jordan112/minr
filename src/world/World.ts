import * as THREE from "three";
import { BlockId } from "./BlockType";
import { Chunk } from "./Chunk";
import { buildChunkMesh } from "./ChunkMesher";
import { TerrainGenerator } from "./TerrainGenerator";
import { TextureManager } from "../rendering/TextureManager";
import { CHUNK_SIZE, RENDER_DISTANCE, WORLD_HEIGHT } from "../utils/constants";

export class World {
  private chunks = new Map<string, Chunk>();
  private scene: THREE.Scene;
  private textureManager: TextureManager;
  private terrainGen: TerrainGenerator;
  private meshesPerFrame = 2;

  constructor(scene: THREE.Scene, textureManager: TextureManager, seed = 42) {
    this.scene = scene;
    this.textureManager = textureManager;
    this.terrainGen = new TerrainGenerator(seed);
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.key(cx, cz));
  }

  getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BlockId.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return BlockId.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  setBlock(wx: number, wy: number, wz: number, id: BlockId): void {
    if (wy < 0 || wy >= WORLD_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, id);

    // Mark neighboring chunks dirty if at edge
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  private markDirty(cx: number, cz: number): void {
    const chunk = this.chunks.get(this.key(cx, cz));
    if (chunk) chunk.isDirty = true;
  }

  update(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Load missing chunks
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const k = this.key(cx, cz);
        if (!this.chunks.has(k)) {
          const chunk = new Chunk(cx, cz);
          this.terrainGen.generate(chunk);
          this.chunks.set(k, chunk);
        }
      }
    }

    // Unload far chunks
    const unloadDist = RENDER_DISTANCE + 2;
    for (const [k, chunk] of this.chunks) {
      const dx = Math.abs(chunk.chunkX - pcx);
      const dz = Math.abs(chunk.chunkZ - pcz);
      if (dx > unloadDist || dz > unloadDist) {
        if (chunk.mesh) this.scene.remove(chunk.mesh);
        this.chunks.delete(k);
      }
    }

    // Remesh dirty chunks (limit per frame)
    let meshed = 0;
    for (const chunk of this.chunks.values()) {
      if (!chunk.isDirty) continue;
      if (meshed >= this.meshesPerFrame) break;

      this.remeshChunk(chunk);
      meshed++;
    }
  }

  private remeshChunk(chunk: Chunk): void {
    // Remove old mesh
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const neighborGetter = (wx: number, wy: number, wz: number): BlockId => {
      return this.getBlock(wx, wy, wz);
    };

    const geometry = buildChunkMesh(chunk, this.textureManager, neighborGetter);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, this.textureManager.material);
      mesh.position.set(
        chunk.chunkX * CHUNK_SIZE,
        0,
        chunk.chunkZ * CHUNK_SIZE
      );
      this.scene.add(mesh);
      chunk.mesh = mesh;
    }

    chunk.isDirty = false;
  }
}
