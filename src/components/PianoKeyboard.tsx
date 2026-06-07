import React, { forwardRef } from 'react';
import { KeyData } from '../types';
import { PianoKey } from './PianoKey';

interface PianoKeyboardProps {
  pianoLayout: KeyData[];
  activeNotes: Record<string, 'none' | 'user' | 'ai'>;
  onPressKey: (note: string) => void;
  onReleaseKey: (note: string) => void;
}

export const PianoKeyboard = forwardRef<HTMLDivElement, PianoKeyboardProps>(({
  pianoLayout,
  activeNotes,
  onPressKey,
  onReleaseKey,
}, ref) => {
  return (
    <div
      ref={ref}
      id="piano-container"
      className="flex absolute bottom-0 left-0 h-[140px] sm:h-[160px] border-t border-slate-800 z-20 bg-slate-900 select-none"
    >
      {pianoLayout.map((keyData) => {
        const activeState = activeNotes[keyData.note] || 'none';
        return (
          <PianoKey
            key={keyData.note}
            note={keyData.note}
            type={keyData.type}
            activeState={activeState}
            onPress={onPressKey}
            onRelease={onReleaseKey}
          />
        );
      })}
    </div>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';
