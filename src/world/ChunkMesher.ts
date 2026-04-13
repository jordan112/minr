import * as THREE from "three";
import { BlockId, isTransparent } from "./BlockType";
import { Chunk } from "./Chunk";
import { TextureManager } from "../rendering/TextureManager";
import { CHUNK_SIZE, WORLD_HEIGHT } from "../utils/constants";

// Face definitions: [dx, dy, dz, face name, vertex offsets]
interface FaceDef {
  dir: [number, number, number];
  uvFace: "top" | "bottom" | "side";
  vertices: [number, number, number][]; // 4 vertices per face
}

const FACES: FaceDef[] = [
  { // Right (+X)
    dir: [1, 0, 0], uvFace: "side",
    vertices: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]],
  },
  { // Left (-X)
    dir: [-1, 0, 0], uvFace: "side",
    vertices: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]],
  },
  { // Top (+Y)
    dir: [0, 1, 0], uvFace: "top",
    vertices: [[0,1,1], [1,1,1], [1,1,0], [0,1,0]],
  },
  { // Bottom (-Y)
    dir: [0, -1, 0], uvFace: "bottom",
    vertices: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]],
  },
  { // Front (+Z)
    dir: [0, 0, 1], uvFace: "side",
    vertices: [[1,0,1], [1,1,1], [0,1,1], [0,0,1]],
  },
  { // Back (-Z)
    dir: [0, 0, -1], uvFace: "side",
    vertices: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]],
  },
];

export type NeighborGetter = (dx: number, dy: number, dz: number) => BlockId;

export function buildChunkMesh(
  chunk: Chunk,
  textureManager: TextureManager,
  getNeighborBlock: NeighborGetter
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockId = chunk.getBlock(x, y, z);
        if (blockId === BlockId.AIR) continue;

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          // Get neighbor block (cross-chunk via callback)
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

          // Only emit face if neighbor is transparent
          if (!isTransparent(neighborId)) continue;
          // Don't draw faces between same transparent blocks
          if (blockId === neighborId) continue;

          const [u0, v0, u1, v1] = textureManager.getUVs(blockId, face.uvFace);

          // Emit 4 vertices
          for (const [vx, vy, vz] of face.vertices) {
            positions.push(x + vx, y + vy, z + vz);
            normals.push(dx, dy, dz);
          }

          // UVs: bottom-left, top-left, top-right, bottom-right
          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);

          // Two triangles
          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}
