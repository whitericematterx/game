import React, { useState, useCallback, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UI } from './components/UI';
import { PlayerStats, BiomeType, LoreEntry } from './types';
import { generateLore } from './services/geminiService';
import { GameEngine } from './game/GameEngine';
import { KEYS } from './constants';

const App: React.FC = () => {
    const [stats, setStats] = useState<PlayerStats>({
        position: { x: 0, y: 0, z: 0 },
        stamina: 100,
        isFlying: false,
        biome: BiomeType.PLAINS,
        timeOfDay: 0.25
    });
    
    const [lore, setLore] = useState<LoreEntry[]>([]);
    const [canScan, setCanScan] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [celebrationEntry, setCelebrationEntry] = useState<LoreEntry | null>(null);
    const engineRef = useRef<GameEngine | null>(null);
    
    const handleStatsUpdate = useCallback((newStats: PlayerStats) => {
        setStats(newStats);
    }, []);

    const handlePOIUpdate = useCallback((available: boolean) => {
        setCanScan(available);
    }, []);

    const handleScan = useCallback(async () => {
        if (!engineRef.current || isScanning || !canScan) return;
        
        const poiInfo = engineRef.current.getClosestPOI();
        if (!poiInfo) return;

        setIsScanning(true);
        setScanProgress(0);
        engineRef.current.startScanEffect(); // Visuals
        
        const timeStr = engineRef.current.getTimeStr();
        const landmarkType = "Glowing Monolith"; 
        
        // Progress bar simulation
        const progressInterval = setInterval(() => {
            setScanProgress(prev => Math.min(prev + 2, 95));
        }, 50);

        try {
            const data = await generateLore(poiInfo.biome, timeStr, landmarkType);
            
            // Complete progress
            clearInterval(progressInterval);
            setScanProgress(100);
            
            // Small delay at 100% before showing result
            await new Promise(r => setTimeout(r, 500));

            const newEntry: LoreEntry = {
                id: Date.now().toString(),
                title: data.title,
                content: data.content,
                timestamp: Date.now()
            };

            setLore(prev => [newEntry, ...prev]);
            setCelebrationEntry(newEntry);

            // Auto hide celebration after a few seconds
            setTimeout(() => {
                setCelebrationEntry(null);
            }, 5000);

        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setIsScanning(false);
            setScanProgress(0);
        }
    }, [canScan, isScanning]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === KEYS.SCAN && canScan && !isScanning) {
                handleScan();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canScan, handleScan, isScanning]);

    return (
        <div className="relative w-screen h-screen bg-black overflow-hidden">
            <GameCanvas 
                onStatsUpdate={handleStatsUpdate} 
                onPOIUpdate={handlePOIUpdate}
                onEngineReady={(engine) => engineRef.current = engine}
            />
            <UI 
                stats={stats} 
                lore={lore} 
                onScan={handleScan}
                canScan={canScan}
                isScanning={isScanning}
                scanProgress={scanProgress}
                celebrationEntry={celebrationEntry}
                toggleLock={() => engineRef.current?.requestPointerLock()}
            />
        </div>
    );
};

export default App;