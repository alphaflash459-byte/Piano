import { useEffect, useRef, useState } from 'react';
import { SettingsMenu } from './components/SettingsMenu';
import { PianoKeyboard } from './components/PianoKeyboard';
import { PianoSynthesizer } from './audio/PianoSynthesizer';
import { songPresets } from './data/songs';
import { InstrumentType, SongNote, Particle } from './types';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType>('acoustic_piano');
  const [selectedSongId, setSelectedSongId] = useState<string>('furelise');
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTimeSeconds, setPlayTimeSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Dynamic user songs
  const [songMenu, setSongMenu] = useState<Array<{ id: string; name: string }>>([
    { id: 'furelise', name: '🎹 Für Elise (Beethoven)' },
    { id: 'twinkle', name: '🌟 Twinkle Twinkle Little Star' },
  ]);

  // Combined song dictionary for immediate lookup
  const songsDictRef = useRef<Record<string, SongNote[]>>({ ...songPresets });

  // Synthesizer instance
  const synthRef = useRef<PianoSynthesizer>(new PianoSynthesizer());

  // Component rendering references
  const pianoContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Game Loop Tracking References
  const isPlayingRef = useRef<boolean>(false);
  const isAutoPlayRef = useRef<boolean>(true);
  const animationFrameIdRef = useRef<number | null>(null);
  const activeNotesRef = useRef<SongNote[]>([]);
  const startTimeRef = useRef<number>(0);
  const particleArrayRef = useRef<Particle[]>([]);
  const keyPositionsRef = useRef<Record<string, { x: number; width: number }>>({});
  const timerIntervalRef = useRef<number | null>(null);

  // State of the keyboard (none, user-pressed, ai-pressed)
  const [activeKeyStates, setActiveKeyStates] = useState<Record<string, 'none' | 'user' | 'ai'>>({});
  const activeKeyStatesRef = useRef<Record<string, 'none' | 'user' | 'ai'>>({});

  // Sync state switches to mutable refs for optimal canvas loop performance
  useEffect(() => {
    isAutoPlayRef.current = isAutoPlay;
  }, [isAutoPlay]);

  // Initialize and center the keyboard on mount
  useEffect(() => {
    updateLayoutCoefficients();
    window.addEventListener('resize', handleResizeWindow);

    // Initial keyboard scroll center target
    setTimeout(() => {
      const activeContainer = pianoContainerRef.current;
      if (activeContainer && scrollAreaRef.current) {
        // Query key C4 for optimal center
        const c4Key = activeContainer.querySelector('[data-note="C4"]') as HTMLElement;
        if (c4Key) {
          const centerScroll = c4Key.offsetLeft - scrollAreaRef.current.offsetWidth / 2 + c4Key.offsetWidth / 2;
          scrollAreaRef.current.scrollLeft = centerScroll;
        }
      }
    }, 450);

    return () => {
      window.removeEventListener('resize', handleResizeWindow);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      synthRef.current.stopAll();
    };
  }, []);

  // Recalculates piano keys offsets mapping relative to parent layout container
  const updateLayoutCoefficients = () => {
    const container = pianoContainerRef.current;
    if (!container) return;

    const keys = container.querySelectorAll('.key');
    const positions: Record<string, { x: number; width: number }> = {};

    keys.forEach((node) => {
      const element = node as HTMLElement;
      const note = element.dataset.note;
      if (note) {
        positions[note] = {
          x: element.offsetLeft,
          width: element.offsetWidth,
        };
      }
    });

    keyPositionsRef.current = positions;

    // Synchronize canvas size to keyboard width
    const canvas = canvasRef.current;
    if (canvas && scrollAreaRef.current) {
      canvas.width = container.offsetWidth;
      // Screen space minus keyboard container height which sits on bottom (140px / 160px)
      const pianoHeight = window.innerWidth <= 640 ? 140 : 160;
      canvas.height = scrollAreaRef.current.offsetHeight - pianoHeight;

      // Sync game-area width dyamically to support absolute positioned children without width collapse
      if (gameAreaRef.current) {
        gameAreaRef.current.style.width = `${container.offsetWidth}px`;
      }
    }
  };

  const handleResizeWindow = () => {
    updateLayoutCoefficients();
  };

  // Sound triggers coordinate by user
  const setKeyStateSync = (note: string, mode: 'none' | 'user' | 'ai') => {
    activeKeyStatesRef.current[note] = mode;
    setActiveKeyStates({ ...activeKeyStatesRef.current });
  };

  const handleUserPressKey = (note: string) => {
    synthRef.current.resumeContext();
    // Start synthesizing audio waves immediately
    synthRef.current.triggerNoteStart(note, currentInstrument);
    setKeyStateSync(note, 'user');

    // Trigger visual blast particles
    triggerParticlesForNote(note);

    // If game is active, check note hits matching
    if (isPlayingRef.current && !isAutoPlayRef.current) {
      checkHitMatching(note);
    }
  };

  const handleUserReleaseKey = (note: string) => {
    synthRef.current.triggerNoteStop(note);
    setKeyStateSync(note, 'none');
  };

  // Visual burst particles engine
  const triggerParticlesForNote = (note: string) => {
    const pos = keyPositionsRef.current[note];
    const canvas = canvasRef.current;
    if (!pos || !canvas) return;

    const layout = synthRef.current.pianoLayout.find(k => k.note === note);
    const isBlack = layout ? layout.type === 'black' : false;
    const color = isBlack ? '#10b981' : '#c084fc'; // neon green or purple

    const spawnY = canvas.height;
    const spawnX = pos.x + pos.width / 2;

    for (let i = 0; i < 10; i++) {
      particleArrayRef.current.push({
        x: spawnX,
        y: spawnY,
        color,
        size: Math.random() * 5 + 3,
        speedX: Math.random() * 6 - 3,
        speedY: Math.random() * -6 - 3,
        life: 1.0,
      });
    }
  };

  // Matches user press event with falling target notes
  const checkHitMatching = (note: string) => {
    const elapsed = synthRef.current.getCurrentTime() - startTimeRef.current;
    const hitToleranceWindow = 0.35; // seconds

    for (let i = 0; i < activeNotesRef.current.length; i++) {
      const activeObj = activeNotesRef.current[i];
      if (activeObj.note === note && !activeObj.hitByUser && !activeObj.playedByAI) {
        // Evaluate horizontal timing offsets
        if (Math.abs(activeObj.time - elapsed) <= hitToleranceWindow) {
          activeObj.hitByUser = true;
          break;
        }
      }
    }
  };

  // Handles custom uploaded MIDI file parsing
  const handleCustomMidiLoaded = (songId: string, customNotes: Array<{ note: string; time: number; duration: number }>, filename: string) => {
    // Add loaded notes mapping
    songsDictRef.current[songId] = customNotes;

    // Update song presets lists state
    const cleanName = filename.length > 22 ? `${filename.slice(0, 19)}...` : filename;
    setSongMenu((prev) => [
      ...prev,
      { id: songId, name: `📥 បទផ្ទាល់ខ្លួន (MIDI): ${cleanName}` },
    ]);
    setSelectedSongId(songId);

    // Scroll automatically to start pitch
    setTimeout(() => {
      if (customNotes.length > 0) {
        const firstNoteCode = customNotes[0].note;
        scrollToNoteKey(firstNoteCode);
      }
    }, 400);
  };

  const scrollToNoteKey = (note: string) => {
    const activeContainer = pianoContainerRef.current;
    if (activeContainer && scrollAreaRef.current) {
      const keyEl = activeContainer.querySelector(`[data-note="${note}"]`) as HTMLElement;
      if (keyEl) {
        scrollAreaRef.current.scrollTo({
          left: keyEl.offsetLeft - scrollAreaRef.current.offsetWidth / 2 + keyEl.offsetWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  };

  // Visual layout refresh and calculation loop
  const startPlaybackSimulation = () => {
    synthRef.current.initContext();
    synthRef.current.resumeContext();

    const targetSong = songsDictRef.current[selectedSongId];
    if (!targetSong || targetSong.length === 0) return;

    // Sync state values
    isPlayingRef.current = true;
    setIsPlaying(true);
    setPlayTimeSeconds(0);

    particleArrayRef.current = [];

    // Clear active key representations
    setActiveKeyStates({});
    activeKeyStatesRef.current = {};

    // 1-second elapsed counter intervals
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setPlayTimeSeconds((prev) => prev + 1);
    }, 1000);

    // Autoplay trigger time setup (adds standard 3 second lead-in path)
    const timeLeadIn = 3;
    startTimeRef.current = synthRef.current.getCurrentTime() + timeLeadIn;

    // Standard deep-clone sequence to secure game timeline modification without damaging static layouts
    activeNotesRef.current = targetSong.map((n) => ({
      ...n,
      hitByUser: false,
      playedByAI: false,
      isCurrentlyPlaying: false,
    }));

    // Trigger animation loop
    updateLayoutCoefficients();
    animationFrameIdRef.current = requestAnimationFrame(renderCanvasLoop);
  };

  const stopPlaybackSimulation = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Shut down sound synthesis
    synthRef.current.stopAll();

    // Reset visual highlight arrays
    setActiveKeyStates({});
    activeKeyStatesRef.current = {};

    // Clean drawing space
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const renderCanvasLoop = () => {
    if (!isPlayingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Refresh canvas base
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentTime = synthRef.current.getCurrentTime() - startTimeRef.current;
    const hitLineY = canvas.height;
    const NOTE_SPEED = 180; // pixels per second
    let pendingNoteSlices = false;

    // 1. Process visual particles list
    const particles = particleArrayRef.current;
    for (let i = 0; i < particles.length; i++) {
       const group = particles[i];
       group.x += group.speedX;
       group.y += group.speedY;
       group.life -= 0.04;
       group.size *= 0.96;

       if (group.life <= 0) {
         particles.splice(i, 1);
         i--;
         continue;
       }

       ctx.save();
       ctx.globalAlpha = group.life;
       ctx.fillStyle = group.color;
       ctx.shadowBlur = 10;
       ctx.shadowColor = group.color;
       ctx.beginPath();
       ctx.arc(group.x, group.y, group.size, 0, Math.PI * 2);
       ctx.fill();
       ctx.restore();
    }

    // 2. Compute notes cascades
    const notesArray = activeNotesRef.current;
    const layoutDetails = synthRef.current.pianoLayout;

    notesArray.forEach((note) => {
      // Evaluate if notes remain inside execution bounds
      if (note.time + note.duration > currentTime - 2) {
        pendingNoteSlices = true;
      }

      const y = hitLineY - (note.time - currentTime) * NOTE_SPEED;
      const height = note.duration * NOTE_SPEED;

      // Draw active falling note bars
      if (y + height > 0 && y - height < canvas.height + 1500) {
        const keyOffset = keyPositionsRef.current[note.note];
        if (keyOffset) {
          const matchingLayout = layoutDetails.find(k => k.note === note.note);
          const isBlack = matchingLayout ? matchingLayout.type === 'black' : false;

          ctx.save();
          const noteGradient = ctx.createLinearGradient(0, y - height, 0, y);

          if (isBlack) {
            noteGradient.addColorStop(0, '#059669'); // emerald-600
            noteGradient.addColorStop(1, '#10b981'); // emerald-500
          } else {
            noteGradient.addColorStop(0, '#7513ca'); // royal purple
            noteGradient.addColorStop(1, '#a855f7'); // neon-purple
          }

          ctx.fillStyle = noteGradient;
          ctx.shadowBlur = 15;
          ctx.shadowColor = isBlack ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)';

          // Accent feedback visual status
          const hasBeenCleared = note.hitByUser || (note.playedByAI && note.isCurrentlyPlaying);
          ctx.globalAlpha = hasBeenCleared ? 1.0 : 0.75;

          ctx.beginPath();
          // Draw high-precision smooth rounded bars
          ctx.roundRect(keyOffset.x + 3, y - height, keyOffset.width - 6, height, 6);
          ctx.fill();

          // Stroke border glow accents
          ctx.strokeStyle = isBlack ? '#34d399' : '#d8b4fe';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. AI Autoplay trigger evaluations
      if (isAutoPlayRef.current) {
        // Triggers audio playback upon crossing hitline boundaries
        if (!note.playedByAI && currentTime >= note.time) {
          note.playedByAI = true;
          note.isCurrentlyPlaying = true;

          synthRef.current.triggerNoteStart(note.note, currentInstrument);
          setKeyStateSync(note.note, 'ai');

          // Align scroll view dynamically to follow along with active pitches
          const keyPos = keyPositionsRef.current[note.note];
          if (keyPos && scrollAreaRef.current) {
            // Autoscroll to key dynamically
            const viewLeft = scrollAreaRef.current.scrollLeft;
            const viewRight = viewLeft + scrollAreaRef.current.clientWidth;
            if (keyPos.x < viewLeft + 100 || keyPos.x > viewRight - 100) {
              scrollAreaRef.current.scrollTo({
                left: keyPos.x - scrollAreaRef.current.clientWidth / 2 + keyPos.width / 2,
                behavior: 'smooth',
              });
            }
          }

          // Particles trigger on key hitline crossing
          triggerParticlesForNote(note.note);
        }

        // Stops sound once note passes over boundary completely
        if (note.isCurrentlyPlaying && currentTime >= note.time + note.duration) {
          note.isCurrentlyPlaying = false;
          synthRef.current.triggerNoteStop(note.note);
          setKeyStateSync(note.note, 'none');
        }
      }
    });

    // End song loop when all notes pass boundary limits
    const lastNoteObj = notesArray[notesArray.length - 1];
    const durationCompleted = lastNoteObj ? lastNoteObj.time + lastNoteObj.duration : 0;

    if (!pendingNoteSlices || currentTime > durationCompleted + 1.2) {
      setTimeout(() => {
        stopPlaybackSimulation();
      }, 1200);
    } else {
      animationFrameIdRef.current = requestAnimationFrame(renderCanvasLoop);
    }
  };

  const handleInstrumentChange = (inst: InstrumentType) => {
    setCurrentInstrument(inst);
    synthRef.current.stopAll();
  };

  const handleSongChange = (songId: string) => {
    setSelectedSongId(songId);
    stopPlaybackSimulation();

    // Auto scroll view towards first sequence note
    const selectedSongNotes = songsDictRef.current[songId];
    if (selectedSongNotes && selectedSongNotes.length > 0) {
      const code = selectedSongNotes[0].note;
      setTimeout(() => {
        scrollToNoteKey(code);
      }, 300);
    }
  };

  const toggleSettingsPanel = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-screen relative w-full overflow-hidden bg-slate-950 font-sans">
      
      {/* Dynamic Glassmorphic Navigation Header Bar */}
      <header className="z-[70] shrink-0 p-3 flex sm:p-4 items-center justify-between shadow-2xl glass-header bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="flex flex-col">
          <h1 className="text-base sm:text-lg md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 tracking-wider">
            NEON PIANO
          </h1>
          <span className="hidden sm:inline text-[9px] text-slate-500 font-mono">
            VITE/REACT WEB AUDIO SYNTHESIZER
          </span>
        </div>

        {/* Center Section: Playback Stopwatch timing badges */}
        <div className="flex items-center justify-center flex-1 mx-3">
          <div className="bg-slate-950 px-3 sm:px-4 py-1.5 rounded-full border border-cyan-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${isPlaying ? 'visible' : 'hidden'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-cyan-500' : 'bg-slate-700'}`} />
            </span>
            <span id="play-time" className="text-xs sm:text-sm md:text-base font-bold text-cyan-400 font-mono w-10 sm:w-12 text-center">
              {formatTimer(playTimeSeconds)}
            </span>
          </div>
        </div>

        {/* Action Controls Side: Play triggers and settings togglers */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? stopPlaybackSimulation : startPlaybackSimulation}
            className={`font-semibold py-1.5 px-4 sm:px-6 rounded-full transition-all text-xs sm:text-sm uppercase tracking-wider transform hover:scale-105 active:scale-95 flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:from-cyan-400 hover:to-blue-400'
            }`}
          >
            <span>{isPlaying ? 'បញ្ឈប់ ⏹' : 'លេង ▶'}</span>
          </button>

          <button
            onClick={toggleSettingsPanel}
            className={`p-2 rounded-full border border-slate-700 transition-all cursor-pointer group ${
              isSettingsOpen ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Toggle setting elements panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : 'group-hover:rotate-45'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Floating responsive parameters settings drawer panel */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentInstrument={currentInstrument}
        onInstrumentChange={handleInstrumentChange}
        selectedSongId={selectedSongId}
        onSongChange={handleSongChange}
        availableSongs={songMenu}
        isAutoPlay={isAutoPlay}
        onAutoPlayToggle={setIsAutoPlay}
        onMidiLoaded={handleCustomMidiLoaded}
        onStartLoading={() => setIsLoading(true)}
        onStopLoading={() => setIsLoading(false)}
      />

      {/* MIDI processing async loading cover */}
      {isLoading && (
        <div id="loading-overlay" className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex justify-center items-center flex-col">
          <div className="relative flex justify-center items-center">
            <div className="absolute animate-ping inline-flex h-16 w-16 rounded-full bg-purple-500 opacity-40" />
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 z-10" />
          </div>
          <h2 className="text-sm sm:text-base text-slate-300 font-semibold mt-4 sm:mt-6 tracking-widest font-mono uppercase">
            កំពុងបម្លែងចំណាំភ្លេង (Processing MIDI track)...
          </h2>
        </div>
      )}

      {/* Game/Interaction Canvas + Virtual Keyboard Scroll Workspace Wrapper */}
      <div
        ref={scrollAreaRef}
        id="scroll-area"
        className="flex-grow w-full overflow-x-auto overflow-y-hidden custom-scrollbar relative z-0 bg-slate-950"
      >
        <div ref={gameAreaRef} id="game-area" className="relative inline-block min-w-full h-full">
          {/* Falling note cascades renderer canvas block */}
          <canvas ref={canvasRef} id="game-canvas" className="z-0 absolute top-0 left-0" />

          {/* Dynamic Hit Line positioning overlay */}
          <div
            id="hit-line"
            className="absolute w-full h-[2px] bg-gradient-to-r from-cyan-500/90 via-purple-500/90 to-cyan-500/90 shadow-[0_0_15px_rgba(6,182,212,0.8),0_0_4px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
            style={{ bottom: window.innerWidth <= 640 ? '140px' : '160px' }}
          />

          {/* Combined Visual Piano Keyboard arrangement */}
          <PianoKeyboard
            ref={pianoContainerRef}
            pianoLayout={synthRef.current.pianoLayout}
            activeNotes={activeKeyStates}
            onPressKey={handleUserPressKey}
            onReleaseKey={handleUserReleaseKey}
          />
        </div>
      </div>
    </div>
  );
}

// Global visual time format helper string
function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
