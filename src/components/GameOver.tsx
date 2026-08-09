import React from 'react';
import { GameSnapshot } from '../types/game';
import { RotateCcw, Home, Trophy, Flame, Candy, Clock, Award } from 'lucide-react';

interface GameOverProps {
  snapshot: GameSnapshot;
  onPlayAgain: () => void;
  onExitMenu: () => void;
  isNewHighScore: boolean;
}

export const GameOver: React.FC<GameOverProps> = ({
  snapshot,
  onPlayAgain,
  onExitMenu,
  isNewHighScore
}) => {
  const { player, playerRank, timeSurvived } = snapshot;

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl z-50 flex items-center justify-center p-6 select-none animate-fade-in text-white">
      <div className="relative w-full max-w-lg bg-purple-950/90 border-2 border-pink-500/40 rounded-3xl p-8 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] text-center flex flex-col gap-6">
        {/* New High Score Badge */}
        {isNewHighScore && (
          <div className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-widest mx-auto shadow-lg animate-bounce">
            <Award className="w-4 h-4" />
            <span>NEW HIGH SCORE RECORD!</span>
          </div>
        )}

        <div>
          <h2 className="text-5xl font-black bg-gradient-to-r from-pink-400 via-rose-400 to-amber-300 bg-clip-text text-transparent uppercase tracking-tight">
            GAME OVER
          </h2>
          <p className="text-sm font-extrabold text-pink-300 uppercase tracking-widest mt-1">
            FINAL RANK #{playerRank}
          </p>
        </div>

        {/* Detailed Match Statistics */}
        <div className="grid grid-cols-2 gap-4 bg-purple-900/50 p-6 rounded-2xl border border-purple-500/30 text-left">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-pink-300 font-extrabold block uppercase">TOTAL SCORE</span>
              <span className="text-xl font-black text-amber-300">
                {player.score.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Candy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-pink-300 font-extrabold block uppercase">SUGAR HELD</span>
              <span className="text-xl font-black text-white">
                {Math.floor(player.sugar).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-pink-300 font-extrabold block uppercase">KILLS</span>
              <span className="text-xl font-black text-white">{player.kills}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-pink-300 font-extrabold block uppercase">SURVIVED</span>
              <span className="text-xl font-black text-white">
                {Math.floor(timeSurvived / 60)}m {timeSurvived % 60}s
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white text-xl font-extrabold tracking-wide rounded-2xl shadow-xl hover:shadow-[0_8px_32px_rgba(236,72,153,0.6)] transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <RotateCcw className="w-6 h-6" />
            <span>PLAY AGAIN</span>
          </button>

          <button
            onClick={onExitMenu}
            className="w-full py-3.5 bg-purple-900/50 hover:bg-purple-800/80 border border-purple-500/30 text-pink-200 hover:text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <Home className="w-5 h-5" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
