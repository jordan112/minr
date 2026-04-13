import * as THREE from "three";
import { BlockId, isTransparent } from "./BlockType";
import { Chunk } from "./Chunk";
import { TextureManager } from "../rendering/TextureManager";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../utils/constants";

interface FaceDef {
  dir: [number, number, number];
  uvFace: "top" | "bottom" | "side";
  vertices: [number, number, number][];
}

const FACES: FaceDef[] = [
  { dir: [1, 0, 0], uvFace: "side", vertices: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]] },
  { dir: [-1, 0, 0], uvFace: "side", vertices: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]] },
  { dir: [0, 1, 0], uvFace: "top", vertices: [[0,1,1], [1,1,1], [1,1,0], [0,1,0]] },
  { dir: [0, -1, 0], uvFace: "bottom", vertices: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]] },
  { dir: [0, 0, 1], uvFace: "side", vertices: [[1,0,1], [1,1,1], [0,1,1], [0,0,1]] },
  { dir: [0, 0, -1], uvFace: "side", vertices: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]] },
];

export type NeighborGetter = (dx: number, dy: number, dz: number) => BlockId;

export interface ChunkMeshResult {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
}

function buildGeometry(
  positions: number[], normals: number[], uvs: number[], indices: number[]
): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function buildChunkMesh(
  chunk: Chunk,
  textureManager: TextureManager,
  getNeighborBlock: NeighborGetter
): ChunkMeshResult {
  // Separate arrays for solid and water geometry
  const solid = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], vertexCount: 0 };
  const water = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], indices: [] as number[], vertexCount: 0 };

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockId = chunk.getBlock(x, y, z);
        if (blockId === BlockId.AIR) continue;

        const isWater = blockId === BlockId.WATER;
        const target = isWater ? water : solid;

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          let neighborId: BlockId;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT) {
            neighborId = getNeighborBlock(
              chunk.chunkX * CHUNK_SIZE + nx,
              ny,
              chunk.chunkZ * CHUNK_SIZE + nz
            );
          } else {
            neighborId = chunk.getBlock(nx, ny, nz);
          }

          if (!isTransparent(neighborId)) continue;
          if (blockId === neighborId) continue;

          const [u0, v0, u1, v1] = textureManager.getUVs(blockId, face.uvFace);

          for (const [vx, vy, vz] of face.vertices) {
            target.positions.push(x + vx, y + vy, z + vz);
            target.normals.push(dx, dy, dz);
          }

          target.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);

          target.indices.push(
            target.vertexCount, target.vertexCount + 1, target.vertexCount + 2,
            target.vertexCount, target.vertexCount + 2, target.vertexCount + 3
          );
          target.vertexCount += 4;
        }
      }
    }
  }

  return {
    solid: buildGeometry(solid.positions, solid.normals, solid.uvs, solid.indices),
    water: buildGeometry(water.positions, water.normals, water.uvs, water.indices),
  };
}
