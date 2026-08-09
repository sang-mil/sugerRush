import React from 'react';
import { GameSnapshot } from '../types/game';
import { soundManager } from '../game/audio';
import { Play, Home, Volume2, VolumeX, Trophy, Flame } from 'lucide-react';

interface PauseMenuProps {
  snapshot: GameSnapshot | null;
  onResume: () => void;
  onExitMenu: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  snapshot,
  onResume,
  onExitMenu,
  isAudioMuted,
  onToggleAudio
}) => {
  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 select-none animate-fade-in text-white">
      <div className="relative w-full max-w-md bg-purple-950/90 border border-purple-500/40 rounded-3xl p-8 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-center flex flex-col gap-6">
        <div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-pink-400 via-amber-300 to-rose-400 bg-clip-text text-transparent uppercase tracking-tight">
            GAME PAUSED
          </h2>
          <p className="text-xs text-pink-300 font-bold uppercase tracking-wider mt-1">
            Take a breather, dessert warrior
          </p>
        </div>

        {snapshot && (
          <div className="grid grid-cols-2 gap-3 bg-purple-900/50 p-4 rounded-2xl border border-purple-500/30 text-left text-xs font-bold">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-pink-300 block uppercase">CURRENT RANK</span>
                <span className="text-sm font-black text-white">#{snapshot.playerRank}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <div>
                <span className="text-[10px] text-pink-300 block uppercase">KILLS</span>
                <span className="text-sm font-black text-white">{snapshot.player.kills}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-pink-300 block uppercase">SUGAR HELD</span>
              <span className="text-sm font-black text-amber-300">
                {Math.floor(snapshot.player.sugar).toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-pink-300 block uppercase">SURVIVED TIME</span>
              <span className="text-sm font-black text-white">
                {Math.floor(snapshot.timeSurvived / 60)}m {snapshot.timeSurvived % 60}s
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white text-lg font-extrabold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>RESUME GAME</span>
          </button>

          <button
            onClick={onToggleAudio}
            className="w-full py-3.5 bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 text-pink-200 hover:text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {isAudioMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            <span>{isAudioMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}</span>
          </button>

          <button
            onClick={onExitMenu}
            className="w-full py-3.5 bg-purple-900/40 hover:bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <Home className="w-5 h-5" />
            <span>EXIT TO MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
