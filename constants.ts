
import { BiomeType } from './types';

export const CHUNK_SIZE = 100;
export const RENDER_DISTANCE = 5; // Slightly reduced for performance with better visuals
export const WATER_LEVEL = 1.5; 

export const BIOME_COLORS = {
    [BiomeType.PLAINS]: 0x88D151, // Vibrant "Ghibli" Green
    [BiomeType.FOREST]: 0x2E7D32, // Deep Pine Green
    [BiomeType.DESERT]: 0xFFCA28, // Warm Golden Sand
    [BiomeType.SNOW]: 0xF5F5F5, // Soft White
    [BiomeType.WATER]: 0x00BCD4, // Tropical Teal (Shallow)
    [BiomeType.MOUNTAIN]: 0x78909C, // Cool Grey Stone
    [BiomeType.SAKURA]: 0xF8BBD0, // Soft Pink
};

export const SKY_COLORS = {
    DAY: 0x4FC3F7, // Rich Sky Blue
    DUSK: 0xFF7043, // Sunset Orange
    NIGHT: 0x1A237E, // Deep Indigo
};

export const KEYS = {
    FORWARD: 'KeyW',
    BACKWARD: 'KeyS',
    LEFT: 'KeyA',
    RIGHT: 'KeyD',
    JUMP: 'Space',
    SPRINT: 'ShiftLeft',
    SCAN: 'KeyE',
};

export const STAMINA_MAX = 100;
export const FLIGHT_COST = 25;
export const REGEN_RATE = 15;
export const SCAN_DURATION = 2000; // ms
