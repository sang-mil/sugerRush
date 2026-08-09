import { useState, useRef, useEffect } from 'react';
import { GameState, CharacterId, GameSnapshot } from './types/game';
import { GameEngine } from './game/GameEngine';
import { GameCanvas } from './components/GameCanvas';
import { MainMenu } from './components/MainMenu';
import { CharacterSelect } from './components/CharacterSelect';
import { HUD } from './components/HUD';
import { PauseMenu } from './components/PauseMenu';
import { GameOver } from './components/GameOver';
import { soundManager } from './game/audio';
import { MultiplayerClient } from './game/MultiplayerClient';
import { INITIAL_BOT_COUNT } from './game/constants';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [nickname, setNickname] = useState<string>('Player123');
  const [selectedChar, setSelectedChar] = useState<CharacterId>('cookie');
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [botCount, setBotCount] = useState<number>(INITIAL_BOT_COUNT);
  const [multiplayerMode, setMultiplayerMode] = useState<boolean>(false);

  const engineRef = useRef<GameEngine | null>(null);
  const startTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
      }
      engineRef.current?.destroy();
    };
  }, []);

  // Load High Score from localStorage on mount
  useEffect(() => {
    try {
      const savedScore = localStorage.getItem('sugarrush_highscore');
      if (savedScore) {
        setHighScore(parseInt(savedScore, 10) || 0);
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  // Handle Game Start
  const handleStartGame = () => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
    }
    engineRef.current?.destroy();
    setGameState('PLAYING');
    setIsNewHighScore(false);

    // Initialize Game Engine if canvas is ready
    startTimerRef.current = window.setTimeout(() => {
      startTimerRef.current = null;
      const canvasEl = document.querySelector('canvas');
      if (canvasEl) {
        engineRef.current = new GameEngine(canvasEl);
        const multiplayerClient = multiplayerMode ? new MultiplayerClient((players) => {
          if (engineRef.current) engineRef.current.remotePlayers = players;
        }, undefined, undefined, (state) => {
          engineRef.current?.applyRemoteSelfState(state);
        }, (projectile) => {
          engineRef.current?.addRemoteProjectile(projectile);
        }) : undefined;
        engineRef.current.initGame(nickname, selectedChar, {
          onSnapshotUpdate: (snap) => setSnapshot(snap),
          onGameOver: (snap) => handleGameOver(snap)
        }, botCount, multiplayerClient);
        engineRef.current.start();
      }
    }, 50);
  };

  // Handle Game Over
  const handleGameOver = (finalSnapshot: GameSnapshot) => {
    engineRef.current?.destroy();
    setSnapshot(finalSnapshot);

    const score = finalSnapshot.player.score;
    if (score > highScore) {
      setHighScore(score);
      setIsNewHighScore(true);
      try {
        localStorage.setItem('sugarrush_highscore', score.toString());
      } catch {
        // LocalStorage error catch
      }
    }

    setGameState('GAME_OVER');
  };

  // Pause Toggle
  const handlePauseToggle = () => {
    if (gameState === 'PLAYING') {
      if (engineRef.current) engineRef.current.stop();
      setGameState('PAUSED');
    } else if (gameState === 'PAUSED') {
      if (engineRef.current) engineRef.current.start();
      setGameState('PLAYING');
    }
  };

  // Exit to Menu
  const handleExitToMenu = () => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    engineRef.current?.destroy();
    engineRef.current = null;
    setGameState('MENU');
  };

  // Toggle Mute Audio
  const handleToggleAudio = () => {
    const muted = soundManager.toggleMute();
    setIsAudioMuted(muted);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 1. Main Menu */}
      {gameState === 'MENU' && (
        <MainMenu
          nickname={nickname}
          setNickname={setNickname}
          selectedChar={selectedChar}
          onOpenCharSelect={() => setGameState('CHAR_SELECT')}
          onStartGame={handleStartGame}
          highScore={highScore}
          botCount={botCount}
          setBotCount={setBotCount}
          multiplayerMode={multiplayerMode}
          setMultiplayerMode={setMultiplayerMode}
        />
      )}

      {/* 2. Character Select */}
      {gameState === 'CHAR_SELECT' && (
        <CharacterSelect
          selectedChar={selectedChar}
          onSelectChar={(id) => setSelectedChar(id)}
          onClose={() => setGameState('MENU')}
        />
      )}

      {/* 3. Game Playing / Paused Canvas */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAME_OVER') && (
        <>
          <GameCanvas engineRef={engineRef} onPauseToggle={handlePauseToggle} />

          <HUD
            snapshot={snapshot}
            onPauseToggle={handlePauseToggle}
            isAudioMuted={isAudioMuted}
            onToggleAudio={handleToggleAudio}
          />
        </>
      )}

      {/* 4. Pause Overlay */}
      {gameState === 'PAUSED' && (
        <PauseMenu
          snapshot={snapshot}
          onResume={handlePauseToggle}
          onExitMenu={handleExitToMenu}
          isAudioMuted={isAudioMuted}
          onToggleAudio={handleToggleAudio}
        />
      )}

      {/* 5. Game Over Screen */}
      {gameState === 'GAME_OVER' && snapshot && (
        <GameOver
          snapshot={snapshot}
          onPlayAgain={handleStartGame}
          onExitMenu={handleExitToMenu}
          isNewHighScore={isNewHighScore}
        />
      )}
    </div>
  );
}
