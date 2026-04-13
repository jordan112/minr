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
}

export interface BlockDef {
  name: string;
  isSolid: boolean;
  isTransparent: boolean;
  // [row, col] in atlas grid
  textures: {
    top: [number, number];
    bottom: [number, number];
    side: [number, number];
  };
  color: { top: string; bottom: string; side: string };
}

const BLOCK_DEFS: Map<BlockId, BlockDef> = new Map();

function def(
  id: BlockId,
  name: string,
  color: { top: string; bottom: string; side: string },
  opts?: { isSolid?: boolean; isTransparent?: boolean },
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
  });
}

// Define all block types with their colors for the procedural atlas
def(BlockId.GRASS, "Grass", { top: "#4a8c2a", bottom: "#6b4226", side: "#6b8c3a" }, {}, 0, 0);
def(BlockId.DIRT, "Dirt", { top: "#6b4226", bottom: "#6b4226", side: "#6b4226" }, {}, 0, 3);
def(BlockId.STONE, "Stone", { top: "#7a7a7a", bottom: "#7a7a7a", side: "#7a7a7a" }, {}, 0, 6);
def(BlockId.WOOD, "Wood", { top: "#8b7242", bottom: "#8b7242", side: "#5c4020" }, {}, 0, 9);
def(BlockId.LEAVES, "Leaves", { top: "#2d6b1e", bottom: "#2d6b1e", side: "#2d6b1e" }, { isTransparent: true }, 0, 12);
def(BlockId.SAND, "Sand", { top: "#d4c484", bottom: "#d4c484", side: "#d4c484" }, {}, 1, 0);
def(BlockId.WATER, "Water", { top: "#3060c0", bottom: "#3060c0", side: "#3060c0" }, { isSolid: false, isTransparent: true }, 1, 3);
def(BlockId.BEDROCK, "Bedrock", { top: "#3a3a3a", bottom: "#3a3a3a", side: "#3a3a3a" }, {}, 1, 6);

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

// All placeable block types for the HUD
export const PLACEABLE_BLOCKS: BlockId[] = [
  BlockId.GRASS,
  BlockId.DIRT,
  BlockId.STONE,
  BlockId.WOOD,
  BlockId.LEAVES,
  BlockId.SAND,
];
