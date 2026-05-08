import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useProgressStore } from '@/store/progressStore';
import { GameEngine, MAX_UNDOS, MAX_SHUFFLES, MAX_PINS } from '@/game/engine';
import HUD from '@/components/HUD';
import BlockTray from '@/components/BlockTray';
import ActionsTray from '@/components/ActionsTray';
import Toast from '@/components/Toast';
import ScorePop from '@/components/ScorePop';
import PauseModal from '@/components/PauseModal';
import type { BlockSpec } from '@/game/types';
import { ensureAudio } from '@/game/audio';

export default function GameScreen() {
  const nav = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [scoreTriggers, setScoreTriggers] = useState<
    Array<{ amount: number; breakdown: Array<[string, number]> }>
  >([]);
  const [height, setHeight] = useState(0);
  const [undosLeft, setUndosLeft] = useState(MAX_UNDOS);
  const [shufflesLeft, setShufflesLeft] = useState(MAX_SHUFFLES);
  const [pinsLeft, setPinsLeft] = useState(MAX_PINS);
  const [pinArmed, setPinArmed] = useState(false);

  const mode = useGameStore((s) => s.mode);
  const challenge = useGameStore((s) => s.challenge);
  const platform = useGameStore((s) => s.platform);
  const goalScore = useGameStore((s) => s.goalScore);
  const goalHeight = useGameStore((s) => s.goalHeight);
  const tray = useGameStore((s) => s.tray);
  const trayCapacity = useGameStore((s) => s.trayCapacity);
  const toast = useGameStore((s) => s.toast);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  const setTray = useGameStore((s) => s.setTray);
  const setTrayCapacity = useGameStore((s) => s.setTrayCapacity);
  const setScore = useGameStore((s) => s.setScore);
  const addScore = useGameStore((s) => s.addScore);
  const setCombo = useGameStore((s) => s.setCombo);
  const setLevel = useGameStore((s) => s.setLevel);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setPhase = useGameStore((s) => s.setPhase);
  const setToast = useGameStore((s) => s.setToast);
  const patchStats = useGameStore((s) => s.patchStats);

  const recordHighScore = useProgressStore((s) => s.recordHighScore);
  const recordEndlessLevel = useProgressStore((s) => s.recordEndlessLevel);
  const recordChallengeComplete = useProgressStore((s) => s.recordChallengeComplete);
  const recordDaily = useProgressStore((s) => s.recordDaily);
  const bumpBlocks = useProgressStore((s) => s.bumpBlocks);
  const bumpCollapses = useProgressStore((s) => s.bumpCollapses);
  const bumpSessions = useProgressStore((s) => s.bumpSessions);

  const finalize = useCallback(
    (won: boolean) => {
      const state = useGameStore.getState();
      bumpSessions();
      bumpBlocks(state.stats.blocksPlaced);
      bumpCollapses(state.stats.collapses);
      const isHigh = recordHighScore(state.mode, state.score);
      if (state.mode === 'endless') recordEndlessLevel(state.level);
      if (state.mode === 'challenge' && state.challenge && won)
        recordChallengeComplete(state.challenge.id);
      if (state.mode === 'daily' && state.challenge) {
        const today = new Date().toISOString().slice(0, 10);
        recordDaily(today, state.score, won);
      }
      setPhase(won ? 'won' : 'lost');
      void isHigh;
      nav('/over');
    },
    [bumpBlocks, bumpCollapses, bumpSessions, nav, recordChallengeComplete, recordDaily, recordEndlessLevel, recordHighScore, setPhase],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    ensureAudio();

    const engine = new GameEngine({
      canvas: canvasRef.current,
      mode,
      challenge,
      platform,
      reduceMotion,
      goalScore,
      goalHeight,
      callbacks: {
        onScore: (n, breakdown) => {
          addScore(n);
          patchStats({ blocksPlaced: useGameStore.getState().stats.blocksPlaced + 1 });
          setScoreTriggers((prev) => [...prev.slice(-6), { amount: n, breakdown }]);
        },
        onCombo: (c) => setCombo(c),
        onLevel: (lvl) => setLevel(lvl),
        onDifficulty: (d) => setDifficulty(d),
        onTray: (t) => setTray(t),
        onTrayCapacity: (n) => setTrayCapacity(n),
        onCollapse: () =>
          patchStats({ collapses: useGameStore.getState().stats.collapses + 1 }),
        onPlace: () => {},
        onLost: () => finalize(false),
        onWon: () => finalize(true),
        onToast: (m) => setToast(m),
        onHeight: (h) => setHeight(h),
        onActionCounts: (u, s, p, armed) => {
          setUndosLeft(u);
          setShufflesLeft(s);
          setPinsLeft(p);
          setPinArmed(armed);
        },
      },
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) {
      (window as unknown as { __engine: GameEngine }).__engine = engine;
    }
    setPhase('playing');
    setScore(0);
    setLevel(1);
    setCombo(0);
    setDifficulty(1);
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!trayRef.current) return;
    const el = trayRef.current;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        engineRef.current?.setBottomReserved(h + 16);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const onUndo = useCallback(() => {
    engineRef.current?.triggerUndo();
  }, []);
  const onShuffle = useCallback(() => {
    engineRef.current?.triggerShuffle();
  }, []);
  const onPin = useCallback(() => {
    engineRef.current?.triggerPin();
  }, []);

  // Tray drag handlers
  const onDragStart = useCallback((spec: BlockSpec, x: number, y: number) => {
    engineRef.current?.beginDrop(spec, x, y);
  }, []);
  const onDragMove = useCallback((x: number, y: number) => {
    engineRef.current?.setPointer(x, y);
  }, []);
  const onDragEnd = useCallback((cancelled: boolean) => {
    if (cancelled) engineRef.current?.cancelDrop();
    else engineRef.current?.releaseDrop();
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) engineRef.current?.pause();
      else engineRef.current?.resume();
      setPhase(next ? 'paused' : 'playing');
      return next;
    });
  }, [setPhase]);

  const restart = useCallback(() => {
    if (!engineRef.current || !canvasRef.current) return;
    engineRef.current.stop();
    setPaused(false);
    nav(0);
  }, [nav]);

  const quit = useCallback(() => {
    engineRef.current?.stop();
    nav('/menu');
  }, [nav]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Game canvas"
      />

      <HUD height={height} onPause={togglePause} />
      <ActionsTray
        onUndo={onUndo}
        onShuffle={onShuffle}
        onPin={onPin}
        undosLeft={undosLeft}
        shufflesLeft={shufflesLeft}
        pinsLeft={pinsLeft}
        pinArmed={pinArmed}
      />
      <BlockTray
        ref={trayRef}
        blocks={tray}
        capacity={trayCapacity}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      />

      <ScorePop triggers={scoreTriggers} />
      <Toast message={toast} onDone={() => setToast(null)} />

      <PauseModal
        open={paused}
        onResume={togglePause}
        onRestart={restart}
        onQuit={quit}
      />
    </div>
  );
}
