import React from 'react';

interface PianoKeyProps {
  note: string;
  type: 'white' | 'black';
  activeState: 'none' | 'user' | 'ai';
  onPress: (note: string) => void;
  onRelease: (note: string) => void;
}

export const PianoKey: React.FC<PianoKeyProps> = ({
  note,
  type,
  activeState,
  onPress,
  onRelease,
}) => {
  const isPressed = activeState !== 'none';
  const isAI = activeState === 'ai';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Avoid double trigger from touch/mouse emulation
    e.preventDefault();
    // Capture pointer resources if supported
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    onPress(note);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    onRelease(note);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onRelease(note);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onRelease(note);
  };

  // Class construction reflecting the CSS
  // Absolute margins for black keys overlapping adjacent white keys
  const baseClass = "key relative cursor-pointer transition-all duration-75 select-none touch-none shrink-0";
  
  let typeClass = "";
  if (type === 'white') {
    typeClass = `w-[38px] sm:w-[42px] h-[140px] sm:h-[160px] bg-gradient-to-b from-white to-slate-100 border-x border-b border-slate-300 z-10 rounded-b-md shadow-[inset_0_-3px_5px_rgba(0,0,0,0.1),0_3px_5px_rgba(0,0,0,0.3)]`;
    if (isPressed) {
      const glowColor = isAI ? 'shadow-[inset_0_-1px_2px_rgba(0,0,0,0.2),0_0_15px_rgba(16,185,129,0.7)]' : 'shadow-[inset_0_-1px_2px_rgba(0,0,0,0.2),0_0_15px_rgba(168,85,247,0.7)]';
      const borderTheme = isAI ? 'border-b-4 border-emerald-500' : 'border-b-4 border-purple-500';
      typeClass += ` bg-slate-200 translate-y-[3px] ${glowColor} ${borderTheme}`;
    }
  } else {
    typeClass = `w-[24px] sm:w-[26px] h-[85px] sm:h-[100px] bg-gradient-to-b from-slate-800 to-slate-950 border border-black z-20 -mx-[12px] sm:-mx-[13px] rounded-b-[4px] shadow-[inset_0_-3px_5px_rgba(255,255,255,0.15),0_3px_5px_rgba(0,0,0,0.75)]`;
    if (isPressed) {
      const glowColor = isAI ? 'shadow-[inset_0_-1px_2px_rgba(255,255,255,0.15),0_0_12px_rgba(16,185,129,0.75)]' : 'shadow-[inset_0_-1px_2px_rgba(255,255,255,0.15),0_0_12px_rgba(34,211,238,0.75)]';
      const borderTheme = isAI ? 'border-b-2 border-emerald-400' : 'border-b-2 border-cyan-400';
      typeClass += ` bg-neutral-900 translate-y-[3px] ${glowColor} ${borderTheme}`;
    }
  }

  return (
    <div
      data-note={note}
      className={`${baseClass} ${typeClass}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      {/* Subtle label showing pitch class with soft color representation */}
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] pointer-events-none font-bold text-slate-400">
        {note.replace('#', '♯')}
      </span>
    </div>
  );
};
