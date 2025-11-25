import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { PlayerStats } from '../types';

interface GameCanvasProps {
    onStatsUpdate: (stats: PlayerStats) => void;
    onPOIUpdate: (available: boolean) => void;
    onEngineReady: (engine: GameEngine) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onStatsUpdate, onPOIUpdate, onEngineReady }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const engine = new GameEngine(
            containerRef.current,
            onStatsUpdate,
            onPOIUpdate
        );
        engineRef.current = engine;
        onEngineReady(engine);

        return () => {
            engine.dispose();
        };
    }, []);

    const handleClick = () => {
        engineRef.current?.requestPointerLock();
    };

    return (
        <div 
            ref={containerRef} 
            className="absolute inset-0 bg-black cursor-none" 
            onClick={handleClick}
        />
    );
};