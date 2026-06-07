export interface KeyData {
  note: string;
  type: 'white' | 'black';
}

export type InstrumentType =
  | 'acoustic_piano'
  | 'electric_piano'
  | 'khloy'
  | 'pinpeat'
  | 'synth_lead'
  | 'organ'
  | 'music_box'
  | '8bit';

export interface SongNote {
  note: string;
  time: number;          // start time in seconds
  duration: number;      // duration in seconds
  hitByUser?: boolean;
  playedByAI?: boolean;
  isCurrentlyPlaying?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
}
