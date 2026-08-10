'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JourneyState {
  theoryCompleted: boolean;
  hand1Trained: boolean;
  hand2Unlocked: boolean;
  hand2Trained: boolean;
  handGameUnlocked: boolean;
  handGameBestScore: number;
  gestureRoomUnlocked: boolean;
  gestureTheoryDone: boolean;
  gestureTrained: boolean;
  gestureGameUnlocked: boolean;
  gestureGameBestScore: number;
  emotionRoomUnlocked: boolean;
  emotionTheoryDone: boolean;
  emotionTrained: boolean;
  emotionGameUnlocked: boolean;
  emotionGameBestScore: number;
  bodyRoomUnlocked: boolean;
  bodyTheoryDone: boolean;
  bodyTrained: boolean;
  bodyGameUnlocked: boolean;
  bodyGameBestScore: number;
  badges: string[];
  totalStars: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ai-journey-progress';

const DEFAULT_STATE: JourneyState = {
  theoryCompleted: false,
  hand1Trained: false,
  hand2Unlocked: false,
  hand2Trained: false,
  handGameUnlocked: false,
  handGameBestScore: 0,
  gestureRoomUnlocked: false,
  gestureTheoryDone: false,
  gestureTrained: false,
  gestureGameUnlocked: false,
  gestureGameBestScore: 0,
  emotionRoomUnlocked: false,
  emotionTheoryDone: false,
  emotionTrained: false,
  emotionGameUnlocked: false,
  emotionGameBestScore: 0,
  bodyRoomUnlocked: false,
  bodyTheoryDone: false,
  bodyTrained: false,
  bodyGameUnlocked: false,
  bodyGameBestScore: 0,
  badges: [],
  totalStars: 0,
};

// ─── Plain helpers (no React dependency) ─────────────────────────────────────

/**
 * Read the journey state from localStorage, merging with DEFAULT_STATE
 * so that any keys added in future versions get their defaults.
 */
export function getJourneyState(): JourneyState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };

    const parsed = JSON.parse(raw) as Partial<JourneyState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Persist the full journey state to localStorage.
 */
export function saveJourneyState(state: JourneyState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[journey-store] Failed to save state', e);
  }
}

/**
 * Remove the journey progress entirely (reset).
 */
export function resetJourney(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[journey-store] Failed to reset', e);
  }
}

// ─── React hook ──────────────────────────────────────────────────────────────

type UpdateFn = (patch: Partial<JourneyState>) => void;

/**
 * React hook that keeps a reactive copy of JourneyState.
 *
 * Returns `[state, update]` where `update` accepts a partial patch that is
 * shallow-merged into the current state and persisted to localStorage.
 */
export function useJourneyStore(): [JourneyState, UpdateFn] {
  const [state, setState] = useState<JourneyState>(DEFAULT_STATE);

  // Hydrate from localStorage once mounted on the client
  useEffect(() => {
    queueMicrotask(() => {
      setState(getJourneyState());
    });
  }, []);

  const update = useCallback<UpdateFn>((patch) => {
    setState((prev) => {
      const next: JourneyState = { ...prev, ...patch };
      saveJourneyState(next);
      return next;
    });
  }, []);

  return [state, update];
}
