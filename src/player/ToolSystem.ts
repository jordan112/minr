export enum ToolType {
  HAND = 0,
  PICKAXE = 1,
  AXE = 2,
  SWORD = 3,
}

export interface ToolDef {
  name: string;
  damage: number;       // damage to animals
  breakSpeed: number;   // block break speed multiplier
  color: string;        // HUD display color
}

const TOOL_DEFS: Record<ToolType, ToolDef> = {
  [ToolType.HAND]: { name: "Hand", damage: 1, breakSpeed: 1, color: "#aa8866" },
  [ToolType.PICKAXE]: { name: "Pickaxe", damage: 2, breakSpeed: 2, color: "#999999" },
  [ToolType.AXE]: { name: "Axe", damage: 4, breakSpeed: 1.5, color: "#888888" },
  [ToolType.SWORD]: { name: "Sword", damage: 7, breakSpeed: 0.5, color: "#aaaacc" },
};

export const ALL_TOOLS: ToolType[] = [ToolType.HAND, ToolType.PICKAXE, ToolType.AXE, ToolType.SWORD];

export function getToolDef(tool: ToolType): ToolDef {
  return TOOL_DEFS[tool];
}
