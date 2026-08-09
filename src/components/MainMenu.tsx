import React, { useState } from 'react';
import { CharacterId } from '../types/game';
import { CHARACTERS } from '../game/constants';
import { soundManager } from '../game/audio';
import { Volume2, VolumeX, Sparkles, Trophy, Play, UserCheck, Candy } from 'lucide-react';

interface MainMenuProps {
  nickname: string;
  setNickname: (val: string) => void;
  selectedChar: CharacterId;
  onOpenCharSelect: () => void;
  onStartGame: () => void;
  highScore: number;
  botCount: number;
  setBotCount: (count: number) => void;
  multiplayerMode: boolean;
  setMultiplayerMode: (enabled: boolean) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  nickname,
  setNickname,
  selectedChar,
  onOpenCharSelect,
  onStartGame,
  highScore,
  botCount,
  setBotCount,
  multiplayerMode,
  setMultiplayerMode
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const currentChar = CHARACTERS[selectedChar] || CHARACTERS.cookie;

  const toggleAudio = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="relative min-h-[100svh] w-full flex flex-col items-center justify-start md:justify-center bg-gradient-to-br from-purple-950 via-pink-950 to-slate-950 text-white overflow-y-auto p-4 pt-20 md:p-6 md:pt-6 select-none">
      {/* Background Candy Grid Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.15)_0%,transparent_70%)] pointer-events-none" />

      {/* Top Bar - Audio & Highscore */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20 sm:top-6 sm:right-6 sm:gap-4">
        <div className="flex items-center gap-2 bg-purple-900/60 border border-purple-500/30 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg text-amber-300 font-bold text-xs sm:px-4 sm:py-2 sm:text-sm">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>BEST SCORE: {highScore.toLocaleString()}</span>
        </div>
        <button
          onClick={toggleAudio}
          className="p-3 bg-purple-900/60 border border-purple-500/30 hover:border-pink-500/50 rounded-full text-pink-300 hover:text-white transition-all shadow-md active:scale-95"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Hero Title Container */}
      <div className="relative flex flex-col items-center mb-8 z-10 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-sm font-semibold tracking-wide mb-3 shadow-inner">
          <Candy className="w-4 h-4 text-pink-400 animate-spin-slow" />
          <span>REAL-TIME DESSERT BRAWL</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-amber-300 to-rose-400 bg-clip-text text-transparent drop-shadow-[0_8px_24px_rgba(236,72,153,0.4)] uppercase">
          SUGAR RUSH
        </h1>
        <p className="text-lg md:text-xl font-bold tracking-widest text-pink-200 mt-2 uppercase drop-shadow-md">
          Grow Sweet. Fight Hard.
        </p>
      </div>

      {/* Main Form Box */}
      <div className="relative w-full max-w-md bg-purple-950/70 border border-pink-500/30 rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-10 flex flex-col gap-4 sm:gap-6">
        {/* Nickname Input */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-pink-300 mb-2 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-pink-400" />
            <span>PLAYER NICKNAME</span>
          </label>
          <input
            type="text"
            maxLength={12}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter nickname..."
            className="w-full bg-purple-900/50 border-2 border-purple-500/40 focus:border-pink-400 focus:outline-none rounded-2xl px-4 py-3 text-lg font-bold text-white placeholder-purple-400/60 shadow-inner transition-all"
          />
        </div>

        {/* Selected Character Preview Box */}
        <div
          onClick={onOpenCharSelect}
          className="group relative flex items-center justify-between bg-purple-900/40 hover:bg-purple-800/50 border-2 border-purple-500/30 hover:border-pink-400/80 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 border-white/20"
              style={{ backgroundColor: currentChar.color }}
            >
              {currentChar.icon}
            </div>
            <div className="text-left">
              <span className="text-xs uppercase font-extrabold tracking-wider text-pink-300 block">
                CHARACTER SELECT
              </span>
              <div className="text-xl font-extrabold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                <span>{currentChar.name}</span>
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-pink-500/30 text-pink-200 border border-pink-500/40">
                  {currentChar.role}
                </span>
              </div>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-pink-400 group-hover:scale-125 transition-transform" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-xs font-extrabold uppercase tracking-wider text-pink-300">
            <span>BOT COUNT</span>
            <select
              value={botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
              className="bg-purple-900/60 border-2 border-purple-500/40 focus:border-pink-400 focus:outline-none rounded-xl px-3 py-3 text-base text-white"
            >
              {[0, 2, 5, 10, 15, 20].map((count) => (
                <option key={count} value={count}>{count} BOTS</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border-2 border-purple-500/40 bg-purple-900/40 px-3 py-3 text-xs font-extrabold uppercase tracking-wider text-pink-300">
            <input
              type="checkbox"
              checked={multiplayerMode}
              onChange={(e) => setMultiplayerMode(e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            <span>ONLINE MODE</span>
          </label>
        </div>

        {/* Play Game Button */}
        <button
          onClick={onStartGame}
          className="w-full py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white text-xl font-extrabold tracking-wide rounded-2xl shadow-[0_8px_24px_rgba(236,72,153,0.5)] hover:shadow-[0_12px_32px_rgba(236,72,153,0.7)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
        >
          <Play className="w-6 h-6 fill-white" />
          <span>PLAY GAME</span>
        </button>
      </div>

      {/* How to Play Footer */}
      <div className="mt-8 text-center text-xs text-pink-300/80 max-w-lg z-10 bg-purple-950/40 border border-purple-500/20 px-6 py-3 rounded-2xl backdrop-blur-md">
        <p className="font-bold text-pink-200 mb-1">🎮 CONTROLS & RULES</p>
        <p>
          <span className="text-amber-300 font-bold">WASD / ↑↓←→</span> Move •{' '}
          <span className="text-amber-300 font-bold">Mouse</span> Aim & Shoot •{' '}
          <span className="text-amber-300 font-bold">SPACE</span> Ability •{' '}
          <span className="text-amber-300 font-bold">ESC</span> Pause
        </p>
        <p className="mt-1 text-pink-400">
          *Eat Sugar to grow, but beware: High Sugar triggers Sugar Decay & High Bounty!
        </p>
      </div>
    </div>
  );
};
