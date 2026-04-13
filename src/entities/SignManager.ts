import * as THREE from "three";
import { Sign } from "./Sign";
import { World } from "../world/World";
import { BlockId } from "../world/BlockType";
import { CHUNK_SIZE } from "../utils/constants";

const SIGN_CHECK_RADIUS = 60;
const SIGN_SPACING = 40; // minimum distance between signs

const FISHING_MESSAGES = [
  ["FISHING SPOT", "Equip Rod (Tab)", "Click on water", "to cast!"],
  ["GONE FISHIN'", "Hold click to", "reel 'em in!"],
  ["LAKE RULES:", "1. Cast into water", "2. Wait for bite", "3. Click to hook!"],
  ["TIP:", "Keep marker in", "the green zone", "to catch fish!"],
  ["WARNING:", "Sharks spotted!", "Fish at your", "own risk!"],
  ["WELCOME", "Right-click to", "place blocks!"],
];

export class SignManager {
  private signs: Sign[] = [];
  private scene: THREE.Scene;
  private world: World;
  private checkedChunks = new Set<string>();
  private checkTimer = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    this.checkTimer = 2; // check every 2 seconds

    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Check chunks near the player for sign placement
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;

        if (this.checkedChunks.has(key)) continue;
        this.checkedChunks.add(key);

        this.tryPlaceSign(cx, cz);
      }
    }

    // Remove far-away signs
    for (let i = this.signs.length - 1; i >= 0; i--) {
      const sign = this.signs[i]!;
      const dx = sign.position.x - playerX;
      const dz = sign.position.z - playerZ;
      if (dx * dx + dz * dz > 100 * 100) {
        this.scene.remove(sign.group);
        this.signs.splice(i, 1);
      }
    }
  }

  private tryPlaceSign(cx: number, cz: number): void {
    // Look for water-edge positions in this chunk
    const wx = cx * CHUNK_SIZE;
    const wz = cz * CHUNK_SIZE;

    // Sample a few spots
    for (let attempt = 0; attempt < 3; attempt++) {
      const x = wx + 3 + Math.floor(Math.random() * (CHUNK_SIZE - 6));
      const z = wz + 3 + Math.floor(Math.random() * (CHUNK_SIZE - 6));

      // Check if this is a shore location (grass block next to water)
      let surfaceY = -1;
      for (let y = 80; y >= 1; y--) {
        const block = this.world.getBlock(x, y, z);
        if (block === BlockId.GRASS || block === BlockId.SAND) {
          surfaceY = y;
          break;
        }
      }
      if (surfaceY < 0) continue;

      // Check for adjacent water
      let hasWater = false;
      let waterDir = 0;
      for (const [ddx, ddz, dir] of [[1,0,0], [-1,0,Math.PI], [0,1,-Math.PI/2], [0,-1,Math.PI/2]] as [number,number,number][]) {
        for (let dy = -1; dy <= 1; dy++) {
          if (this.world.getBlock(x + ddx, surfaceY + dy, z + ddz) === BlockId.WATER) {
            hasWater = true;
            waterDir = dir;
          }
        }
      }
      if (!hasWater) continue;

      // Check spacing from other signs
      let tooClose = false;
      for (const existing of this.signs) {
        const dx = existing.position.x - x;
        const dz = existing.position.z - z;
        if (dx * dx + dz * dz < SIGN_SPACING * SIGN_SPACING) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Make sure there's air above for the sign
      if (this.world.getBlock(x, surfaceY + 1, z) !== BlockId.AIR) continue;
      if (this.world.getBlock(x, surfaceY + 2, z) !== BlockId.AIR) continue;

      // Place a sign!
      const lines = FISHING_MESSAGES[Math.floor(Math.random() * FISHING_MESSAGES.length)]!;
      const sign = new Sign(x, surfaceY + 1, z, lines, waterDir);
      this.signs.push(sign);
      this.scene.add(sign.group);
      return; // One sign per chunk max
    }
  }
}
