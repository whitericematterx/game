
import React, { useEffect, useRef, useState } from 'react';
import { PlayerStats, LoreEntry } from '../types';
import { Battery, Wind, MapPin, Terminal, AlertTriangle, Activity, ChevronDown, ChevronUp, Star, Cpu } from 'lucide-react';

interface UIProps {
    stats: PlayerStats;
    lore: LoreEntry[];
    onScan: () => void;
    canScan: boolean;
    isScanning: boolean;
    scanProgress: number;
    celebrationEntry: LoreEntry | null;
    toggleLock: () => void;
}

export const UI: React.FC<UIProps> = ({ stats, lore, onScan, canScan, isScanning, scanProgress, celebrationEntry, toggleLock }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showControls, setShowControls] = useState(true);
    const [isLogMinimized, setIsLogMinimized] = useState(false);

    useEffect(() => {
        if (scrollRef.current && !isLogMinimized) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lore, isLogMinimized]);

    useEffect(() => {
        const t = setTimeout(() => setShowControls(false), 8000);
        return () => clearTimeout(t);
    }, []);

    const formatTime = (t: number) => {
        const hours = Math.floor(t * 24);
        const mins = Math.floor((t * 24 % 1) * 60);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    return (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-white">
            
            {/* Reticle / Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center pointer-events-none">
                 {/* Outer ring that expands when scanning */}
                 <div className={`rounded-full border border-white/40 transition-all duration-300 ${isScanning ? 'w-12 h-12 border-cyan-400 rotate-180' : 'w-6 h-6'}`} />
                 
                 {/* Inner dot */}
                 <div className={`absolute rounded-full transition-all duration-200 ${canScan ? 'w-2 h-2 bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'w-1 h-1 bg-white/80'}`} />
                 
                 {/* Scanning Ping */}
                 {canScan && !isScanning && <div className="absolute w-8 h-8 border border-cyan-400/50 rounded-full animate-ping" />}
            </div>

            {/* Celebration Overlay */}
            {celebrationEntry && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-black/80 border border-cyan-500/50 p-8 rounded-2xl max-w-md text-center shadow-[0_0_100px_rgba(34,211,238,0.2)]">
                        <div className="flex justify-center mb-4">
                            <Star className="w-12 h-12 text-cyan-300 animate-pulse" fill="currentColor" />
                        </div>
                        <h2 className="text-2xl font-black text-cyan-400 mb-2 tracking-tight uppercase">
                            Monolith Decoded
                        </h2>
                        <h3 className="text-white font-bold text-lg mb-6 uppercase tracking-widest border-b border-white/10 pb-4">
                            {celebrationEntry.title}
                        </h3>
                        <p className="text-gray-300 leading-relaxed font-mono text-sm">
                            "{celebrationEntry.content}"
                        </p>
                        <div className="mt-8 text-xs text-cyan-500/50 uppercase tracking-widest">
                            Archive Updated
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                        AETHERIA <span className="text-xs font-normal bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300/80">VER 2.8</span>
                    </h1>
                    <div className="text-cyan-400/60 text-xs font-bold flex items-center gap-6 uppercase tracking-widest">
                        <span className="flex items-center gap-2"><MapPin size={14}/> {Math.round(stats.position.x)}, {Math.round(stats.position.z)}</span>
                        <span className="flex items-center gap-2"><Activity size={14}/> {stats.biome}</span>
                        <span>T: {formatTime(stats.timeOfDay)}</span>
                    </div>
                </div>
                
                {/* Lore Log */}
                <div className="w-[400px] flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-2">
                         <h3 className="text-cyan-500/80 font-bold text-[10px] uppercase tracking-widest">Data Archive</h3>
                         <button 
                            onClick={() => setIsLogMinimized(!isLogMinimized)}
                            className="p-1 hover:bg-white/10 rounded text-cyan-400/80 transition-colors"
                         >
                            {isLogMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                         </button>
                    </div>
                    
                    {!isLogMinimized && (
                        <div 
                            ref={scrollRef}
                            className="w-full max-h-[30vh] overflow-y-auto pr-2 space-y-2 transition-all"
                            style={{ direction: 'rtl' }}
                        >
                            <div style={{ direction: 'ltr' }} className="flex flex-col gap-2">
                                {lore.map((entry) => (
                                    <div key={entry.id} className="bg-black/60 border-l-2 border-cyan-500/40 p-3 rounded-r-lg backdrop-blur-md">
                                        <h4 className="text-cyan-200/90 font-bold text-xs uppercase mb-1 flex justify-between items-center">
                                            {entry.title}
                                        </h4>
                                        <p className="text-gray-400 text-[10px] leading-relaxed">{entry.content}</p>
                                    </div>
                                ))}
                                {lore.length === 0 && (
                                    <div className="text-right text-cyan-500/20 text-[10px] font-bold tracking-widest uppercase p-2">No Data Collected</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Center Notifications */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto z-30 pt-20">
                {showControls && !celebrationEntry && (
                    <div className="bg-black/60 p-6 rounded-xl border border-white/10 backdrop-blur-xl shadow-2xl animate-out fade-out duration-1000 delay-[7000ms] fill-mode-forwards min-w-[280px]">
                        <h3 className="text-sm font-bold mb-4 text-cyan-400 tracking-widest border-b border-white/10 pb-2">CONTROLS</h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-left">
                            <span className="font-bold text-white">WASD</span> <span className="text-gray-500">MOVE</span>
                            <span className="font-bold text-white">SPACE</span> <span className="text-gray-500">JUMP / FLY</span>
                            <span className="font-bold text-white">SHIFT</span> <span className="text-gray-500">BOOST</span>
                            <span className="font-bold text-white">E</span> <span className="text-gray-500">SCAN POI</span>
                        </div>
                    </div>
                )}
                
                {canScan && !isScanning && !celebrationEntry && (
                    <div className="flex flex-col items-center gap-2 animate-bounce">
                        <span className="bg-cyan-500 text-black font-black text-[10px] px-3 py-1 rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                            SCAN OBJECT [E]
                        </span>
                    </div>
                )}

                {isScanning && (
                    <div className="flex flex-col items-center gap-4">
                         <div className="bg-black/80 p-4 rounded-lg border border-cyan-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.1)] min-w-[250px]">
                            <div className="flex items-center justify-between mb-2 text-cyan-400">
                                <span className="font-bold text-[10px] tracking-widest animate-pulse">DECRYPTING...</span>
                                <Cpu className="w-3 h-3 animate-spin" />
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-75 ease-linear"
                                    style={{ width: `${scanProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-auto">
                
                {/* Stats */}
                <div className="flex flex-col gap-2 w-64">
                    <div className="flex items-center justify-between text-cyan-400/80 text-[10px] font-bold tracking-widest">
                        <span className="flex items-center gap-2"><Battery size={12}/> ENERGY</span>
                        <span>{Math.round(stats.stamina)}%</span>
                    </div>
                    
                    <div className="relative h-2 w-full bg-gray-900/80 rounded-sm overflow-hidden border border-white/5">
                        <div 
                            className={`h-full transition-all duration-200 ease-out ${stats.stamina < 25 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'}`}
                            style={{ width: `${stats.stamina}%` }}
                        />
                    </div>
                    
                    {stats.isFlying && (
                        <div className="flex items-center gap-2 text-amber-400/80 text-[9px] font-bold tracking-widest animate-pulse mt-1">
                            <Wind size={10} /> THRUSTERS ACTIVE
                        </div>
                    )}
                </div>

                {/* Lock Prompt */}
                <button 
                    onClick={toggleLock}
                    className="bg-white/5 hover:bg-white/10 text-white/50 px-4 py-2 rounded border border-white/5 backdrop-blur-sm transition-all active:scale-95 flex items-center gap-2 group hover:text-white"
                >
                    <Terminal size={12} />
                    <span className="font-bold text-[10px] tracking-widest">CAPTURE CURSOR</span>
                </button>
            </div>

            {/* Critical Warning */}
            {stats.isFlying && stats.stamina < 15 && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 text-red-500 font-bold text-sm animate-ping flex items-center gap-2 border border-red-500/30 px-4 py-1 rounded bg-red-900/20 backdrop-blur">
                    <AlertTriangle size={16} /> ENERGY CRITICAL
                </div>
            )}
        </div>
    );
};
