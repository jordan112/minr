/**
 * Floating loot text that appears when killing a mob or catching a fish.
 */
export class LootPopup {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      pointerEvents: "none",
      zIndex: "110",
    });
    document.body.appendChild(this.container);
  }

  show(text: string, color = "#ffdd44"): void {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: "50%",
      top: "40%",
      transform: "translateX(-50%)",
      color,
      fontFamily: "monospace",
      fontSize: "18px",
      fontWeight: "bold",
      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
      transition: "all 1.5s ease-out",
      opacity: "1",
    });
    el.textContent = text;
    this.container.appendChild(el);

    // Animate up and fade
    requestAnimationFrame(() => {
      el.style.top = "25%";
      el.style.opacity = "0";
    });

    setTimeout(() => el.remove(), 1500);
  }
}

// Loot tables
export interface LootDrop {
  item: string;
  xp: number;
}

const MOB_LOOT: Record<string, LootDrop[]> = {
  zombie: [
    { item: "Rotten Flesh", xp: 5 },
    { item: "Bone", xp: 5 },
    { item: "Iron Nugget", xp: 8 },
  ],
  sheep: [
    { item: "Wool x2", xp: 2 },
    { item: "Raw Mutton", xp: 3 },
  ],
  pig: [
    { item: "Raw Porkchop", xp: 3 },
    { item: "Leather", xp: 2 },
  ],
  cow: [
    { item: "Raw Beef", xp: 3 },
    { item: "Leather x2", xp: 4 },
  ],
  trex: [
    { item: "Dino Bone", xp: 25 },
    { item: "Rare Scale", xp: 30 },
    { item: "Ancient Tooth", xp: 20 },
  ],
  bigfoot: [
    { item: "Mystery Fur", xp: 15 },
    { item: "Bigfoot Track", xp: 20 },
  ],
  dragon: [
    { item: "Dragon Scale", xp: 35 },
    { item: "Fire Essence", xp: 40 },
    { item: "Dragon Egg!", xp: 50 },
  ],
  unicorn: [
    { item: "Rainbow Dust", xp: 20 },
    { item: "Golden Horn Shard", xp: 25 },
  ],
  yeti: [
    { item: "Frost Crystal", xp: 20 },
    { item: "Yeti Fur", xp: 15 },
  ],
  spartan: [
    { item: "Spartan Shield", xp: 20 },
    { item: "Green Plume", xp: 15 },
    { item: "Go Green!", xp: 25 },
  ],
  hokiebird: [
    { item: "Hokie Feather", xp: 15 },
    { item: "Gobbler Trophy", xp: 20 },
    { item: "Let's Go Hokies!", xp: 25 },
  ],
};

export function rollLoot(mobType: string): LootDrop {
  const table = MOB_LOOT[mobType];
  if (!table || table.length === 0) return { item: "Nothing", xp: 1 };
  return table[Math.floor(Math.random() * table.length)]!;
}
