export enum BiomeType {
    PLAINS = 'Plains',
    FOREST = 'Forest',
    DESERT = 'Desert',
    SNOW = 'Snow',
    WATER = 'Ocean',
    MOUNTAIN = 'Mountain',
    SAKURA = 'Sakura Grove'
}

export interface PlayerStats {
    position: { x: number; y: number; z: number };
    stamina: number;
    isFlying: boolean;
    biome: BiomeType;
    timeOfDay: number; // 0.0 to 1.0
}

export interface LoreEntry {
    id: string;
    title: string;
    content: string;
    timestamp: number;
}

export interface GameConfig {
    playerColor: number;
    viewDistance: number;
}