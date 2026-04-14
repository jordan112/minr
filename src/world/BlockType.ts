export enum BlockId {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  SAND = 6,
  WATER = 7,
  BEDROCK = 8,
  LAVA = 9,
  TORCH = 10,
  TNT = 11,
  // Redstone-lite
  WIRE = 12,
  LEVER = 13,
  LAMP = 14,
  DOOR = 15,
  // Physics
  GRAVEL = 16,
  FIRE = 17,
  GLASS = 18,
  FLOWER_RED = 19,
  FLOWER_BLUE = 20,
  FRUIT_RED = 21,   // apple
  FRUIT_ORANGE = 22, // orange
}

export interface BlockDef {
  name: string;
  isSolid: boolean;
  isTransparent: boolean;
  textures: {
    top: [number, number];
    bottom: [number, number];
    side: [number, number];
  };
  color: { top: string; bottom: string; side: string };
  emitsLight?: boolean;
  gravity?: boolean; // falls like sand/gravel
}

const BLOCK_DEFS: Map<BlockId, BlockDef> = new Map();

function def(
  id: BlockId,
  name: string,
  color: { top: string; bottom: string; side: string },
  opts?: { isSolid?: boolean; isTransparent?: boolean; emitsLight?: boolean; gravity?: boolean },
  texRow = 0,
  texCol = 0
) {
  BLOCK_DEFS.set(id, {
    name,
    isSolid: opts?.isSolid ?? true,
    isTransparent: opts?.isTransparent ?? false,
    textures: {
      top: [texRow, texCol],
      bottom: [texRow, texCol + 1],
      side: [texRow, texCol + 2],
    },
    color,
    emitsLight: opts?.emitsLight,
    gravity: opts?.gravity,
  });
}

// Define all block types with their colors for the procedural atlas
def(BlockId.GRASS, "Grass", { top: "#4a8c2a", bottom: "#6b4226", side: "#6b8c3a" }, {}, 0, 0);
def(BlockId.DIRT, "Dirt", { top: "#6b4226", bottom: "#6b4226", side: "#6b4226" }, {}, 0, 3);
def(BlockId.STONE, "Stone", { top: "#7a7a7a", bottom: "#7a7a7a", side: "#7a7a7a" }, {}, 0, 6);
def(BlockId.WOOD, "Wood", { top: "#8b7242", bottom: "#8b7242", side: "#5c4020" }, {}, 0, 9);
def(BlockId.LEAVES, "Leaves", { top: "#2d6b1e", bottom: "#2d6b1e", side: "#2d6b1e" }, { isTransparent: true }, 0, 12);
def(BlockId.SAND, "Sand", { top: "#d4c484", bottom: "#d4c484", side: "#d4c484" }, { gravity: true }, 1, 0);
def(BlockId.WATER, "Water", { top: "#3060c0", bottom: "#3060c0", side: "#3060c0" }, { isSolid: false, isTransparent: true }, 1, 3);
def(BlockId.BEDROCK, "Bedrock", { top: "#3a3a3a", bottom: "#3a3a3a", side: "#3a3a3a" }, {}, 1, 6);
def(BlockId.LAVA, "Lava", { top: "#ff4400", bottom: "#cc2200", side: "#ee3300" }, { isSolid: false, isTransparent: true, emitsLight: true }, 1, 9);
def(BlockId.TORCH, "Torch", { top: "#ffdd44", bottom: "#6b4226", side: "#6b4226" }, { isTransparent: true, emitsLight: true }, 1, 12);
def(BlockId.TNT, "TNT", { top: "#cc3333", bottom: "#cc3333", side: "#dd4444" }, {}, 2, 0);
// Redstone-lite blocks
def(BlockId.WIRE, "Wire", { top: "#880000", bottom: "#880000", side: "#880000" }, { isTransparent: true }, 2, 3);
def(BlockId.LEVER, "Lever", { top: "#886644", bottom: "#666666", side: "#886644" }, {}, 2, 6);
def(BlockId.LAMP, "Lamp", { top: "#ddddaa", bottom: "#ddddaa", side: "#ddddaa" }, { emitsLight: true }, 2, 9);
def(BlockId.DOOR, "Door", { top: "#6b4226", bottom: "#6b4226", side: "#5a3a20" }, { isTransparent: true }, 2, 12);
// Physics blocks
def(BlockId.GRAVEL, "Gravel", { top: "#888877", bottom: "#888877", side: "#888877" }, { gravity: true }, 3, 0);
def(BlockId.FIRE, "Fire", { top: "#ff6600", bottom: "#ff4400", side: "#ff5500" }, { isSolid: false, isTransparent: true, emitsLight: true }, 3, 3);
def(BlockId.GLASS, "Glass", { top: "#aaddff", bottom: "#aaddff", side: "#aaddff" }, { isTransparent: true }, 3, 6);
def(BlockId.FLOWER_RED, "Poppy", { top: "#ff2222", bottom: "#22aa22", side: "#ff2222" }, { isSolid: false, isTransparent: true }, 3, 9);
def(BlockId.FLOWER_BLUE, "Bluebell", { top: "#4444ff", bottom: "#22aa22", side: "#4444ff" }, { isSolid: false, isTransparent: true }, 3, 12);
def(BlockId.FRUIT_RED, "Apple", { top: "#cc1111", bottom: "#cc1111", side: "#cc1111" }, { isSolid: false, isTransparent: true }, 4, 0);
def(BlockId.FRUIT_ORANGE, "Orange", { top: "#ff8800", bottom: "#ff8800", side: "#ff8800" }, { isSolid: false, isTransparent: true }, 4, 3);

export function getBlockDef(id: BlockId): BlockDef | undefined {
  return BLOCK_DEFS.get(id);
}

export function isSolid(id: BlockId): boolean {
  if (id === BlockId.AIR) return false;
  return BLOCK_DEFS.get(id)?.isSolid ?? false;
}

export function isTransparent(id: BlockId): boolean {
  if (id === BlockId.AIR) return true;
  return BLOCK_DEFS.get(id)?.isTransparent ?? false;
}

export function hasGravity(id: BlockId): boolean {
  return BLOCK_DEFS.get(id)?.gravity ?? false;
}

// All placeable block types for the HUD
export const PLACEABLE_BLOCKS: BlockId[] = [
  BlockId.GRASS,
  BlockId.DIRT,
  BlockId.STONE,
  BlockId.WOOD,
  BlockId.LEAVES,
  BlockId.SAND,
  BlockId.TORCH,
  BlockId.TNT,
  BlockId.WIRE,
  BlockId.LEVER,
  BlockId.LAMP,
  BlockId.DOOR,
  BlockId.GRAVEL,
  BlockId.GLASS,
];
