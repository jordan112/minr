/**
 * Game Mode system.
 *
 * Modes:
 * - Freeplay: normal sandbox (default)
 * - Bedwars: defend your bed from waves of enemies
 */

export type GameModeType = "freeplay" | "bedwars";

export interface GameModeState {
  type: GameModeType;
  // Bedwars state
  wave: number;
  enemiesRemaining: number;
  bedHealth: number;
  maxBedHealth: number;
  bedPos: [number, number, number] | null;
  waveTimer: number;
  betweenWaves: boolean;
  score: number;
  gameOver: boolean;
}

export function createGameState(type: GameModeType): GameModeState {
  return {
    type,
    wave: 0,
    enemiesRemaining: 0,
    bedHealth: 20,
    maxBedHealth: 20,
    bedPos: null,
    waveTimer: 60, // 60 seconds before first wave
    betweenWaves: true,
    score: 0,
    gameOver: false,
  };
}
