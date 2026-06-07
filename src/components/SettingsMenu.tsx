import React, { useRef } from 'react';
import { InstrumentType } from '../types';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentInstrument: InstrumentType;
  onInstrumentChange: (inst: InstrumentType) => void;
  selectedSongId: string;
  onSongChange: (songId: string) => void;
  availableSongs: { id: string; name: string }[];
  isAutoPlay: boolean;
  onAutoPlayToggle: (val: boolean) => void;
  onMidiLoaded: (songId: string, notes: Array<{ note: string; time: number; duration: number }>, name: string) => void;
  onStartLoading: () => void;
  onStopLoading: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  onClose,
  currentInstrument,
  onInstrumentChange,
  selectedSongId,
  onSongChange,
  availableSongs,
  isAutoPlay,
  onAutoPlayToggle,
  onMidiLoaded,
  onStartLoading,
  onStopLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleMidiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onStartLoading();
    onClose();

    try {
      // Dynamic import to avoid bundling blockages
      const { Midi } = await import('@tonejs/midi');
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      const customNotes: Array<{ note: string; time: number; duration: number }> = [];

      // Valid note names to double check against
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      midi.tracks.forEach(track => {
        // Channel 9 is usually drums in General MIDI, skip it
        if (track.channel !== 9) {
          track.notes.forEach(note => {
            const midiNumber = note.midi;
            const octave = Math.floor(midiNumber / 12) - 1;
            const noteNameStr = noteNames[midiNumber % 12];
            const fullNoteName = `${noteNameStr}${octave}`;

            // Check if within bounds of 88 keys
            // Pitch coordinates range standard on 88-key piano
            customNotes.push({
              note: fullNoteName,
              time: note.time,
              duration: note.duration,
            });
          });
        }
      });

      if (customNotes.length > 0) {
        customNotes.sort((a, b) => a.time - b.time);
        const songId = `custom_${Date.now()}`;
        onMidiLoaded(songId, customNotes, file.name);
      } else {
        alert("សុំទោស រកមិនឃើញណោតព្យាណូនៅក្នុងឯកសារនេះទេ។");
      }
    } catch (error) {
      console.error(error);
      alert("មានបញ្ហាក្នុងការអានឯកសារ MIDI នេះ។");
    } finally {
      onStopLoading();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      id="settings-menu"
      className="absolute top-16 right-2 w-[calc(100vw-1rem)] max-w-sm sm:w-80 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[60] p-4 sm:p-5 flex flex-col gap-4 sm:gap-5 animate-in slide-in-from-top-2 duration-155"
    >
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          ការកំណត់ (Settings)
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-800/50 transition-colors"
          aria-label="Close configuration menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Choose Instrument */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide">ឧបករណ៍ភ្លេង (Instrument)</label>
        <select
          id="instrument-select"
          value={currentInstrument}
          onChange={(e) => onInstrumentChange(e.target.value as InstrumentType)}
          className="bg-slate-900 text-cyan-400 font-semibold rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-800 text-xs sm:text-sm transition-all cursor-pointer hover:bg-slate-800 w-full"
        >
          <option value="acoustic_piano">🎹 Soft Piano</option>
          <option value="electric_piano">⚡ Electric Piano</option>
          <option value="khloy">🎋 ខ្លុយខ្មែរ (Khloy Flute)</option>
          <option value="pinpeat">🪘 ពិនពាធ (Pinpeat Orchestra)</option>
          <option value="synth_lead">🚀 Synth Lead</option>
          <option value="organ">⛪ Organ</option>
          <option value="music_box">🎵 Music Box</option>
          <option value="8bit">👾 8-Bit Retro</option>
        </select>
      </div>

      {/* Select Preset Song */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide">បទចម្រៀង (Select Song)</label>
        <select
          id="song-select"
          value={selectedSongId}
          onChange={(e) => onSongChange(e.target.value)}
          className="bg-slate-900 text-white rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-purple-500 border border-slate-800 text-xs sm:text-sm transition-all cursor-pointer hover:bg-slate-800 w-full"
        >
          {availableSongs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Custom MIDI Upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide">បញ្ជូលបទខាងក្រៅ (Import MIDI)</label>
        <label className="cursor-pointer bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-2 px-4 rounded-lg transition-all text-xs sm:text-sm flex items-center justify-center gap-2 w-full text-center shadow-lg shadow-purple-500/20 active:scale-98">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>ផ្ទុកឯកសារ MIDI</span>
          <input
            ref={fileInputRef}
            type="file"
            id="midi-upload"
            accept=".mid,.midi"
            onChange={handleMidiUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* AutoPlay Toggle */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-300">លេងដោយស្វ័យប្រវត្តិ (AI Autoplay)</span>
        <label className="flex items-center cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              id="ai-toggle"
              checked={isAutoPlay}
              onChange={(e) => onAutoPlayToggle(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`block w-10 h-5 sm:w-12 sm:h-6 rounded-full transition-colors ${
                isAutoPlay ? 'bg-purple-500' : 'bg-slate-800'
              }`}
            />
            <div
              className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-transform transform shadow-md ${
                isAutoPlay ? 'translate-x-5 sm:translate-x-6' : ''
              }`}
            />
          </div>
          <div className={`ml-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide ${isAutoPlay ? 'text-purple-400' : 'text-slate-500'}`}>
            AI
          </div>
        </label>
      </div>
    </div>
  );
};
