import React from 'react';
import { CharacterId } from '../types/game';
import { CHARACTERS } from '../game/constants';
import { ArrowLeft, Check, Shield, Zap, Crosshair, Sparkles } from 'lucide-react';

interface CharacterSelectProps {
  selectedChar: CharacterId;
  onSelectChar: (id: CharacterId) => void;
  onClose: () => void;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({ selectedChar, onSelectChar, onClose }) => {
  const charactersList = Object.values(CHARACTERS);

  return (
    <div className="relative w-full h-screen bg-slate-950/95 backdrop-blur-xl text-white flex flex-col justify-between p-6 md:p-10 z-50 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-purple-900/50 border border-purple-500/30 hover:border-pink-500/60 px-4 py-2 rounded-2xl text-pink-300 hover:text-white transition-all cursor-pointer font-bold"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>BACK TO MENU</span>
        </button>

        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-pink-400 via-amber-300 to-rose-400 bg-clip-text text-transparent uppercase tracking-tight">
            CHOOSE YOUR DESSERT
          </h2>
          <p className="text-xs md:text-sm text-pink-300 font-semibold tracking-wider uppercase mt-1">
            Each character possesses unique abilities and tactical playstyles
          </p>
        </div>

        <div className="w-24 hidden md:block" />
      </div>

      {/* Grid of 4 Characters */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-auto">
        {charactersList.map((char) => {
          const isSelected = selectedChar === char.id;

          return (
            <div
              key={char.id}
              onClick={() => onSelectChar(char.id as CharacterId)}
              className={`relative flex flex-col justify-between bg-purple-950/60 border-2 rounded-3xl p-6 backdrop-blur-md cursor-pointer transition-all duration-300 shadow-xl hover:-translate-y-1 ${
                isSelected
                  ? 'border-amber-400 bg-purple-900/80 shadow-[0_12px_32px_rgba(245,158,11,0.3)] ring-2 ring-amber-400/50'
                  : 'border-purple-500/30 hover:border-pink-400/60'
              }`}
            >
              {isSelected && (
                <div className="absolute -top-3 -right-3 bg-amber-400 text-slate-950 p-2 rounded-full shadow-lg font-black flex items-center justify-center border-2 border-white">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
              )}

              <div>
                {/* Visual Avatar Box */}
                <div
                  className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl mb-4 shadow-xl border-4 border-white/20 relative group"
                  style={{ backgroundColor: char.color }}
                >
                  <span>{char.icon}</span>
                  <div className="absolute inset-0 rounded-3xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="text-center mb-4">
                  <h3 className="text-2xl font-black text-white uppercase">{char.name}</h3>
                  <span className="inline-block mt-1 text-xs font-bold px-3 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    {char.role}
                  </span>
                </div>

                {/* Stats Breakdown Bars */}
                <div className="space-y-2.5 text-xs font-bold text-pink-200/90 mb-4 bg-purple-900/40 p-3.5 rounded-2xl border border-purple-500/20">
                  {/* HP */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" /> HP
                      </span>
                      <span>{char.maxHp}</span>
                    </div>
                    <div className="w-full bg-purple-950 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${(char.maxHp / 280) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* SPEED */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" /> SPEED
                      </span>
                      <span>{char.speed}</span>
                    </div>
                    <div className="w-full bg-purple-950 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${(char.speed / 7.2) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* ATTACK */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Crosshair className="w-3.5 h-3.5 text-rose-400" /> BASE ATTACK
                      </span>
                      <span>{char.attackDamage}</span>
                    </div>
                    <div className="w-full bg-purple-950 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-400 h-full rounded-full"
                        style={{ width: `${(char.attackDamage / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Attack Info */}
                <div className="mb-3 bg-purple-900/50 border border-amber-500/30 p-2.5 rounded-2xl text-left">
                  <div className="text-[11px] font-extrabold text-amber-300 uppercase flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-amber-400" />
                    <span>ATTACK: {char.primaryAttackName}</span>
                  </div>
                </div>

                {/* Ability Box */}
                <div className="bg-pink-950/40 border border-pink-500/30 p-3.5 rounded-2xl text-left">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300 uppercase mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>SPECIAL: {char.abilityName}</span>
                  </div>
                  <p className="text-xs text-pink-100/90 leading-relaxed font-medium">
                    {char.abilityDescription}
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChar(char.id as CharacterId);
                  onClose();
                }}
                className={`w-full mt-6 py-3 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg'
                    : 'bg-purple-900/60 hover:bg-pink-600 text-white border border-purple-500/40'
                }`}
              >
                {isSelected ? 'SELECTED' : 'SELECT CHARACTER'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Bottom Footer */}
      <div className="w-full max-w-md mx-auto mt-6 text-center">
        <button
          onClick={onClose}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-extrabold text-lg rounded-2xl shadow-xl transition-all uppercase tracking-wide cursor-pointer"
        >
          CONFIRM SELECTION
        </button>
      </div>
    </div>
  );
};
