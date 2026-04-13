import * as THREE from "three";
import { World } from "../world/World";
import { BlockId, isSolid } from "../world/BlockType";
import { MAX_RAY_DISTANCE } from "../utils/constants";

export interface RaycastHit {
  blockPos: [number, number, number];
  faceNormal: [number, number, number];
}

export class VoxelRaycaster {
  private world: World;
  private highlightMesh: THREE.LineSegments;
  private scene: THREE.Scene;
  lastHit: RaycastHit | null = null;

  constructor(world: World, scene: THREE.Scene) {
    this.world = world;
    this.scene = scene;

    // Wireframe highlight cube
    const boxGeo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    this.highlightMesh = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);
  }

  update(origin: THREE.Vector3, direction: THREE.Vector3): void {
    this.lastHit = this.cast(origin, direction);

    if (this.lastHit) {
      const [bx, by, bz] = this.lastHit.blockPos;
      this.highlightMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
      this.highlightMesh.visible = true;
    } else {
      this.highlightMesh.visible = false;
    }
  }

  // DDA voxel traversal (Amanatides & Woo)
  private cast(origin: THREE.Vector3, direction: THREE.Vector3): RaycastHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x >= 0 ? 1 : -1;
    const stepY = direction.y >= 0 ? 1 : -1;
    const stepZ = direction.z >= 0 ? 1 : -1;

    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = direction.x !== 0
      ? ((stepX > 0 ? x + 1 : x) - origin.x) / direction.x
      : Infinity;
    let tMaxY = direction.y !== 0
      ? ((stepY > 0 ? y + 1 : y) - origin.y) / direction.y
      : Infinity;
    let tMaxZ = direction.z !== 0
      ? ((stepZ > 0 ? z + 1 : z) - origin.z) / direction.z
      : Infinity;

    let faceNormal: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < MAX_RAY_DISTANCE * 3; i++) {
      const block = this.world.getBlock(x, y, z);
      if (isSolid(block)) {
        return { blockPos: [x, y, z], faceNormal };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          faceNormal = [-stepX, 0, 0];
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          faceNormal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          faceNormal = [0, -stepY, 0];
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          faceNormal = [0, 0, -stepZ];
        }
      }

      // Check distance
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dz = z - origin.z;
      if (dx * dx + dy * dy + dz * dz > MAX_RAY_DISTANCE * MAX_RAY_DISTANCE) {
        return null;
      }
    }

    return null;
  }
}
