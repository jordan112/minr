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
      BlockId.FLOWER_RED, BlockId.FLOWER_BLUE,
      BlockId.FRUIT_RED, BlockId.FRUIT_ORANGE,
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

    // Flower textures — draw stem + petals instead of solid fill
    if (blockId === BlockId.FLOWER_RED || blockId === BlockId.FLOWER_BLUE) {
      // Clear to transparent green (grass background)
      ctx.fillStyle = "#4a8c2a";
      ctx.fillRect(x, y, size, size);
      // Green stem
      ctx.fillStyle = "#227722";
      ctx.fillRect(x + 7, y + 8, 2, 8);
      // Leaf
      ctx.fillStyle = "#33aa33";
      ctx.fillRect(x + 5, y + 10, 3, 2);
      // Petals
      const petalColor = blockId === BlockId.FLOWER_RED ? "#ee2222" : "#4444ee";
      ctx.fillStyle = petalColor;
      // 5 petals in cross pattern
      ctx.fillRect(x + 6, y + 3, 4, 3); // top
      ctx.fillRect(x + 6, y + 8, 4, 2); // bottom
      ctx.fillRect(x + 3, y + 5, 3, 3); // left
      ctx.fillRect(x + 10, y + 5, 3, 3); // right
      ctx.fillRect(x + 6, y + 5, 4, 3); // center
      // Yellow center
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(x + 7, y + 5, 2, 2);
      // Petal highlights
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + 7, y + 3, 2, 1);
      ctx.fillRect(x + 4, y + 5, 1, 2);
    }

    // Fruit — small round shape hanging from leaf
    if (blockId === BlockId.FRUIT_RED || blockId === BlockId.FRUIT_ORANGE) {
      // Green leaf background
      ctx.fillStyle = "#2d6b1e";
      ctx.fillRect(x, y, size, size);
      // Add leaf noise
      for (let py2 = 0; py2 < size; py2++) {
        for (let px2 = 0; px2 < size; px2++) {
          if (Math.random() > 0.7) {
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            ctx.fillRect(x + px2, y + py2, 1, 1);
          }
        }
      }
      // Stem
      ctx.fillStyle = "#553311";
      ctx.fillRect(x + 7, y + 3, 2, 3);
      // Fruit body (round-ish)
      const fruitColor = blockId === BlockId.FRUIT_RED ? "#cc1111" : "#ff8800";
      ctx.fillStyle = fruitColor;
      ctx.fillRect(x + 5, y + 6, 6, 5);
      ctx.fillRect(x + 6, y + 5, 4, 7);
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + 6, y + 6, 2, 2);
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + 8, y + 9, 2, 2);
    }

    // Torch — draw stick with flame
    if (blockId === BlockId.TORCH) {
      ctx.fillStyle = "#4a8c2a";
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(x + 7, y + 6, 2, 10);
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(x + 6, y + 3, 4, 4);
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(x + 7, y + 2, 2, 3);
      ctx.fillStyle = "#ffee66";
      ctx.fillRect(x + 7, y + 3, 2, 1);
    }

    // WIRE — dark stone with red circuit line pattern
    if (blockId === BlockId.WIRE) {
      ctx.fillStyle = "#444444";
      ctx.fillRect(x, y, size, size);
      // Stone noise
      for (let py2 = 0; py2 < size; py2++) {
        for (let px2 = 0; px2 < size; px2++) {
          if (Math.random() > 0.7) { ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(x+px2, y+py2, 1, 1); }
        }
      }
      // Red cross wire pattern
      ctx.fillStyle = "#cc0000";
      ctx.fillRect(x + 0, y + 7, 16, 2); // horizontal line
      ctx.fillRect(x + 7, y + 0, 2, 16); // vertical line
      // Bright red center node
      ctx.fillStyle = "#ff2222";
      ctx.fillRect(x + 6, y + 6, 4, 4);
      // Dark red dots at ends
      ctx.fillStyle = "#880000";
      ctx.fillRect(x + 0, y + 6, 2, 4);
      ctx.fillRect(x + 14, y + 6, 2, 4);
      ctx.fillRect(x + 6, y + 0, 4, 2);
      ctx.fillRect(x + 6, y + 14, 4, 2);
    }

    // LEVER — cobblestone base with wooden toggle handle
    if (blockId === BlockId.LEVER) {
      ctx.fillStyle = "#666666";
      ctx.fillRect(x, y, size, size);
      for (let py2 = 0; py2 < size; py2++) {
        for (let px2 = 0; px2 < size; px2++) {
          if (Math.random() > 0.6) { ctx.fillStyle = `rgba(${Math.random()>0.5?'80':'40'},${Math.random()>0.5?'80':'40'},${Math.random()>0.5?'80':'40'},0.3)`; ctx.fillRect(x+px2, y+py2, 1, 1); }
        }
      }
      // Base plate
      ctx.fillStyle = "#555555";
      ctx.fillRect(x + 3, y + 10, 10, 5);
      ctx.fillStyle = "#777777";
      ctx.fillRect(x + 3, y + 10, 10, 1);
      // Toggle handle (wooden stick)
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(x + 7, y + 2, 2, 9);
      // Handle knob
      ctx.fillStyle = "#aa8833";
      ctx.fillRect(x + 6, y + 1, 4, 3);
    }

    // LAMP — glassy block with glowstone-like pattern
    if (blockId === BlockId.LAMP) {
      ctx.fillStyle = "#bbaa77";
      ctx.fillRect(x, y, size, size);
      // Glowstone crystal pattern
      const lampColors = ["#ddcc88", "#ccbb66", "#eedd99", "#bbaa55"];
      for (let py2 = 0; py2 < size; py2 += 4) {
        for (let px2 = 0; px2 < size; px2 += 4) {
          ctx.fillStyle = lampColors[Math.floor(Math.random() * lampColors.length)]!;
          ctx.fillRect(x + px2, y + py2, 4, 4);
          // Inner glow
          ctx.fillStyle = "rgba(255,255,200,0.3)";
          ctx.fillRect(x + px2 + 1, y + py2 + 1, 2, 2);
        }
      }
      // Border
      ctx.fillStyle = "#887744";
      ctx.fillRect(x, y, size, 1);
      ctx.fillRect(x, y + size - 1, size, 1);
      ctx.fillRect(x, y, 1, size);
      ctx.fillRect(x + size - 1, y, 1, size);
    }

    // DOOR — wooden plank door with handle
    if (blockId === BlockId.DOOR) {
      ctx.fillStyle = "#7a5a30";
      ctx.fillRect(x, y, size, size);
      // Wood grain
      for (let px2 = 0; px2 < size; px2 += 3) {
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.fillRect(x + px2, y, 1, size);
      }
      // Horizontal planks
      ctx.fillStyle = "#6a4a20";
      ctx.fillRect(x, y + 5, size, 1);
      ctx.fillRect(x, y + 10, size, 1);
      // Door frame
      ctx.fillStyle = "#5a3a15";
      ctx.fillRect(x, y, size, 1);
      ctx.fillRect(x, y + size - 1, size, 1);
      ctx.fillRect(x, y, 1, size);
      ctx.fillRect(x + size - 1, y, 1, size);
      // Handle (iron knob)
      ctx.fillStyle = "#999999";
      ctx.fillRect(x + 11, y + 7, 3, 2);
      ctx.fillStyle = "#bbbbbb";
      ctx.fillRect(x + 12, y + 7, 1, 1);
    }

    // GLASS — transparent with cross pattern
    if (blockId === BlockId.GLASS) {
      ctx.fillStyle = "rgba(180,220,255,0.4)";
      ctx.fillRect(x, y, size, size);
      // Glass pane frame
      ctx.fillStyle = "rgba(150,200,240,0.6)";
      ctx.fillRect(x, y, size, 1);
      ctx.fillRect(x, y + size - 1, size, 1);
      ctx.fillRect(x, y, 1, size);
      ctx.fillRect(x + size - 1, y, 1, size);
      // Cross divider
      ctx.fillRect(x + 7, y, 2, size);
      ctx.fillRect(x, y + 7, size, 2);
      // Shine
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + 2, y + 2, 4, 4);
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
