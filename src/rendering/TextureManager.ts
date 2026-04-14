import * as THREE from "three";
import { BlockId, getBlockDef } from "../world/BlockType";

const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; // 16

export class TextureManager {
  material!: THREE.MeshLambertMaterial;
  private atlas!: THREE.CanvasTexture;

  constructor() {
    this.generateAtlas();
  }

  private generateAtlas() {
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Fill background with magenta (debug: easy to spot unmapped UVs)
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Draw each block face tile
    for (const blockId of [
      BlockId.GRASS, BlockId.DIRT, BlockId.STONE, BlockId.WOOD,
      BlockId.LEAVES, BlockId.SAND, BlockId.WATER, BlockId.BEDROCK,
      BlockId.LAVA, BlockId.TORCH, BlockId.TNT,
      BlockId.WIRE, BlockId.LEVER, BlockId.LAMP, BlockId.DOOR,
      BlockId.GRAVEL, BlockId.FIRE, BlockId.GLASS,
    ]) {
      const def = getBlockDef(blockId);
      if (!def) continue;

      for (const face of ["top", "bottom", "side"] as const) {
        const [row, col] = def.textures[face];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const color = def.color[face];

        // Base color
        ctx.fillStyle = color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Add noise/texture pattern
        this.addNoise(ctx, x, y, TILE_SIZE, color, blockId, face);
      }
    }

    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.MeshLambertMaterial({ map: this.atlas });

    // Separate transparent material for water/lava
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    // Lava material with emissive glow
    this.lavaMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas,
      transparent: true,
      opacity: 0.85,
      emissive: 0xff4400,
      emissiveIntensity: 0.6,
    });
  }

  waterMaterial!: THREE.MeshLambertMaterial;
  lavaMaterial!: THREE.MeshLambertMaterial;

  private addNoise(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number,
    baseColor: string, blockId: BlockId, face: string
  ) {
    // Parse base color
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Add pixel-level noise for a Minecraft-like texture feel
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const noise = (Math.random() - 0.5) * 30;
        const nr = Math.max(0, Math.min(255, r + noise));
        const ng = Math.max(0, Math.min(255, g + noise));
        const nb = Math.max(0, Math.min(255, b + noise));
        ctx.fillStyle = `rgb(${nr | 0},${ng | 0},${nb | 0})`;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }

    // Special patterns for specific blocks
    if (blockId === BlockId.GRASS && face === "side") {
      // Green top strip on grass side
      const gr = parseInt("#4a8c2a".slice(1, 3), 16);
      const gg = parseInt("#4a8c2a".slice(3, 5), 16);
      const gb = parseInt("#4a8c2a".slice(5, 7), 16);
      for (let px = 0; px < size; px++) {
        for (let py = 0; py < 3; py++) {
          const noise = (Math.random() - 0.5) * 20;
          ctx.fillStyle = `rgb(${(gr + noise) | 0},${(gg + noise) | 0},${(gb + noise) | 0})`;
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }

    if (blockId === BlockId.WOOD && face === "side") {
      // Vertical bark lines
      for (let px = 0; px < size; px += 4) {
        for (let py = 0; py < size; py++) {
          ctx.fillStyle = `rgba(0,0,0,0.15)`;
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  }

  getUVs(blockId: BlockId, face: "top" | "bottom" | "side"): [number, number, number, number] {
    const def = getBlockDef(blockId);
    if (!def) return [0, 0, 0, 0];

    const [row, col] = def.textures[face];
    const u0 = col / TILES_PER_ROW + 0.5 / ATLAS_SIZE;
    const v0 = 1 - (row + 1) / TILES_PER_ROW + 0.5 / ATLAS_SIZE;
    const u1 = (col + 1) / TILES_PER_ROW - 0.5 / ATLAS_SIZE;
    const v1 = 1 - row / TILES_PER_ROW - 0.5 / ATLAS_SIZE;

    return [u0, v0, u1, v1];
  }
}
