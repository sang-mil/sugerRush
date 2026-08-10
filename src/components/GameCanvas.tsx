import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { Crosshair, Pause, Zap } from 'lucide-react';

interface GameCanvasProps {
  engineRef: React.RefObject<GameEngine | null>;
  onPauseToggle: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engineRef, onPauseToggle }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const aimJoystickRef = useRef<HTMLDivElement | null>(null);
  const onPauseToggleRef = useRef(onPauseToggle);
  onPauseToggleRef.current = onPauseToggle;

  const clearJoystick = () => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) engine.keys[key] = false;
    engine.mobileMove = { x: 0, y: 0 };
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(-50%, -50%)';
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const engine = engineRef.current;
    const joystick = joystickRef.current;
    if (!engine || !joystick) return;

    const rect = joystick.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    clearJoystick();
    const maxDistance = rect.width * 0.34;
    const distance = Math.min(Math.hypot(dx, dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    if (joystickKnobRef.current) {
      const knobX = Math.cos(angle) * distance;
      const knobY = Math.sin(angle) * distance;
      joystickKnobRef.current.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }
    if (Math.hypot(dx, dy) > rect.width * 0.1) {
      engine.mobileMove = {
        x: Math.max(-1, Math.min(1, dx / maxDistance)),
        y: Math.max(-1, Math.min(1, dy / maxDistance))
      };
    }
  };

  const clearAimJoystick = () => {
    if (engineRef.current) engineRef.current.isMouseDown = false;
  };

  const updateAimJoystick = (clientX: number, clientY: number) => {
    const engine = engineRef.current;
    const joystick = aimJoystickRef.current;
    if (!engine || !joystick) return;

    const rect = joystick.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance < rect.width * 0.12) return;

    const directionX = dx / distance;
    const directionY = dy / distance;
    engine.mousePos = {
      x: window.innerWidth / 2 + directionX * 180,
      y: window.innerHeight / 2 + directionY * 180
    };
    engine.isMouseDown = true;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle Window Resize
    const handleResize = () => {
      canvas.width = Math.max(1, Math.floor(window.innerWidth));
      canvas.height = Math.max(1, Math.floor(window.innerHeight));
      if (engineRef.current) {
        engineRef.current.camera.resize(canvas.width, canvas.height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Keyboard Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        onPauseToggleRef.current();
        return;
      }
      if (e.code === 'F2') {
        if (engineRef.current) {
          engineRef.current.showDebug = !engineRef.current.showDebug;
        }
        return;
      }
      if (engineRef.current) {
        engineRef.current.keys[e.code] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (engineRef.current) {
        engineRef.current.keys[e.code] = false;
      }
    };

    // Mouse Listeners
    const handleMouseMove = (e: MouseEvent) => {
      if (engineRef.current) {
        engineRef.current.mousePos = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && engineRef.current) {
        engineRef.current.isMouseDown = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && engineRef.current) {
        engineRef.current.isMouseDown = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      visualViewport?.removeEventListener('resize', handleResize);
      clearJoystick();
      if (engineRef.current) engineRef.current.isMouseDown = false;
    };
  }, [engineRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (event.pointerType !== 'touch' || !engineRef.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          engineRef.current.mousePos = { x: event.clientX, y: event.clientY };
          engineRef.current.isMouseDown = true;
        }}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch' && engineRef.current?.isMouseDown) {
            engineRef.current.mousePos = { x: event.clientX, y: event.clientY };
          }
        }}
        onPointerUp={(event) => {
          if (event.pointerType === 'touch' && engineRef.current) {
            engineRef.current.isMouseDown = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          if (engineRef.current) engineRef.current.isMouseDown = false;
        }}
        className="absolute inset-0 w-full h-full block touch-none cursor-crosshair bg-slate-950"
      />

      <div className="pointer-events-none absolute inset-0 z-40 touch-none sm:hidden">
        <div
          ref={joystickRef}
          className="pointer-events-auto absolute bottom-5 left-4 h-36 w-36 rounded-full border-2 border-white/30 bg-slate-900/45 shadow-xl backdrop-blur-sm"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateJoystick(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => updateJoystick(event.clientX, event.clientY)}
          onPointerUp={() => clearJoystick()}
          onPointerCancel={() => clearJoystick()}
        >
          <div ref={joystickKnobRef} className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-300/60 bg-pink-500/70 shadow-lg" />
        </div>

        <div
          ref={aimJoystickRef}
          aria-label="Aim and attack"
          className="pointer-events-auto absolute bottom-5 right-4 flex h-36 w-36 items-center justify-center rounded-full border-2 border-rose-300/70 bg-rose-950/45 text-white shadow-xl backdrop-blur-sm"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateAimJoystick(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => updateAimJoystick(event.clientX, event.clientY)}
          onPointerUp={() => clearAimJoystick()}
          onPointerCancel={() => clearAimJoystick()}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200/80 bg-rose-500/75 shadow-lg">
            <Crosshair className="h-7 w-7" />
          </div>
        </div>

        <button
          type="button"
          aria-label="Use ability"
          className="pointer-events-auto absolute bottom-40 right-28 flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300/70 bg-amber-500/70 text-white shadow-xl active:scale-95"
          onPointerDown={() => {
            if (engineRef.current) engineRef.current.keys.Space = true;
          }}
        >
          <Zap className="h-6 w-6" />
        </button>

        <button
          type="button"
          aria-label="Pause game"
          className="pointer-events-auto absolute right-4 top-24 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-slate-900/60 text-white shadow-lg sm:hidden"
          onPointerDown={onPauseToggle}
        >
          <Pause className="h-5 w-5" />
        </button>
      </div>
    </>
  );
};
