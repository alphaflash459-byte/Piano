import { InstrumentType } from '../types';

export class PianoSynthesizer {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private activeOscillators: Record<string, { oscs: OscillatorNode[]; gain: GainNode; instrument: InstrumentType }> = {};
  public keyFrequencies: Record<string, number> = {};
  public pianoLayout: { note: string; type: 'white' | 'black' }[] = [];

  constructor() {
    this.generate88Keys();
  }

  private generate88Keys() {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let keyNumber = 1;

    // Keys 1, 2, 3: A0, A#0, B0
    const initialNotes = ['A', 'A#', 'B'];
    initialNotes.forEach(note => {
      const freq = 440 * Math.pow(2, (keyNumber - 49) / 12);
      const fullName = `${note}0`;
      this.keyFrequencies[fullName] = freq;
      this.pianoLayout.push({ note: fullName, type: note.includes('#') ? 'black' : 'white' });
      keyNumber++;
    });

    // Keys 4 to 87: Octaves 1 to 7
    for (let octave = 1; octave <= 7; octave++) {
      noteNames.forEach(note => {
        const freq = 440 * Math.pow(2, (keyNumber - 49) / 12);
        const fullName = `${note}${octave}`;
        this.keyFrequencies[fullName] = freq;
        this.pianoLayout.push({ note: fullName, type: note.includes('#') ? 'black' : 'white' });
        keyNumber++;
      });
    }

    // Key 88: C8
    const freqC8 = 440 * Math.pow(2, (88 - 49) / 12);
    this.keyFrequencies['C8'] = freqC8;
    this.pianoLayout.push({ note: 'C8', type: 'white' });
  }

  public initContext() {
    if (this.audioCtx) return;

    // Standard cross-browser setup
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.4;

    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.audioCtx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.audioCtx.currentTime);
    this.compressor.ratio.setValueAtTime(15, this.audioCtx.currentTime);
    this.compressor.attack.setValueAtTime(0.002, this.audioCtx.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.audioCtx.currentTime);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.audioCtx.destination);
  }

  public getContextState(): string {
    return this.audioCtx ? this.audioCtx.state : 'uninitialized';
  }

  public resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public getCurrentTime(): number {
    return this.audioCtx ? this.audioCtx.currentTime : 0;
  }

  public triggerNoteStart(note: string, instrument: InstrumentType) {
    this.initContext();
    this.resumeContext();

    if (!this.audioCtx || !this.masterGain) return;

    // If already playing, turn it off first
    if (this.activeOscillators[note]) {
      this.triggerNoteStop(note);
    }

    const freq = this.keyFrequencies[note];
    if (!freq) return;

    const now = this.audioCtx.currentTime;
    const noteGain = this.audioCtx.createGain();
    noteGain.connect(this.masterGain);
    noteGain.gain.setValueAtTime(0, now);

    const oscs: OscillatorNode[] = [];
    const filter = this.audioCtx.createBiquadFilter();

    switch (instrument) {
      case 'acoustic_piano': {
        noteGain.gain.linearRampToValueAtTime(0.8, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.2, now + 0.4);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 4);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2.5, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.3);
        filter.connect(noteGain);

        const osc1 = this.audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = freq;
        osc1.connect(filter);
        osc1.start(now);
        oscs.push(osc1);

        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const osc2Gain = this.audioCtx.createGain();
        osc2Gain.gain.value = 0.12;
        osc2.connect(osc2Gain).connect(filter);
        osc2.start(now);
        oscs.push(osc2);
        break;
      }

      case 'khloy': {
        // Cambodian Bamboo Flute - smooth, soft breathy attack & vibrato
        noteGain.gain.linearRampToValueAtTime(0.8, now + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.5, now + 0.4);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3, now);
        filter.connect(noteGain);

        const khloyOsc = this.audioCtx.createOscillator();
        khloyOsc.type = 'sine';
        khloyOsc.frequency.value = freq;

        // Vibrato using LFO connected to frequency
        const lfo = this.audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 5.5; // Vibrato speed
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = freq * 0.015; // Depth
        lfo.connect(lfoGain);
        lfoGain.connect(khloyOsc.frequency);
        lfo.start(now);

        khloyOsc.connect(filter);
        khloyOsc.start(now);
        oscs.push(khloyOsc);
        oscs.push(lfo);
        break;
      }

      case 'pinpeat': {
        // Khmer Pinpeat gong / roneat sound (warm, metallic struck element with high damping)
        noteGain.gain.linearRampToValueAtTime(1.0, now + 0.005);
        noteGain.gain.exponentialRampToValueAtTime(0.18, now + 0.15);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 6, now);
        filter.frequency.exponentialRampToValueAtTime(freq, now + 0.15);
        filter.connect(noteGain);

        const roneatOsc = this.audioCtx.createOscillator();
        roneatOsc.type = 'sine';
        roneatOsc.frequency.value = freq;
        roneatOsc.connect(filter);
        roneatOsc.start(now);
        oscs.push(roneatOsc);

        // Struck wooden mallet transient chime (inharmonic overtone decay)
        const chimeOsc = this.audioCtx.createOscillator();
        chimeOsc.type = 'triangle';
        chimeOsc.frequency.value = freq * 2.78;
        const chimeGain = this.audioCtx.createGain();
        chimeGain.gain.setValueAtTime(0.55, now);
        chimeGain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);
        chimeOsc.connect(chimeGain).connect(filter);
        chimeOsc.start(now);
        oscs.push(chimeOsc);
        break;
      }

      case 'electric_piano': {
        noteGain.gain.linearRampToValueAtTime(0.7, now + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.35, now + 0.5);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3, now);
        filter.connect(noteGain);

        const epOsc1 = this.audioCtx.createOscillator();
        epOsc1.type = 'triangle';
        epOsc1.frequency.value = freq;
        epOsc1.connect(filter);
        epOsc1.start(now);
        oscs.push(epOsc1);

        const epOsc2 = this.audioCtx.createOscillator();
        epOsc2.type = 'sine';
        epOsc2.frequency.value = freq * 2;
        const epOsc2Gain = this.audioCtx.createGain();
        epOsc2Gain.gain.value = 0.28;
        epOsc2.connect(epOsc2Gain).connect(filter);
        epOsc2.start(now);
        oscs.push(epOsc2);
        break;
      }

      case 'synth_lead': {
        noteGain.gain.linearRampToValueAtTime(0.6, now + 0.05);
        noteGain.gain.linearRampToValueAtTime(0.4, now + 0.25);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 8, now);
        filter.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.3);
        filter.Q.value = 5;
        filter.connect(noteGain);

        const leadOsc = this.audioCtx.createOscillator();
        leadOsc.type = 'sawtooth';
        leadOsc.frequency.value = freq;
        leadOsc.connect(filter);
        leadOsc.start(now);
        oscs.push(leadOsc);
        break;
      }

      case 'organ': {
        noteGain.gain.linearRampToValueAtTime(0.65, now + 0.02);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.connect(noteGain);

        // Standard drawbars: Sub-octave, Octave, Second Octave
        const osc1 = this.audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = freq;
        osc1.connect(filter);
        osc1.start(now);
        oscs.push(osc1);

        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const osc2Gain = this.audioCtx.createGain();
        osc2Gain.gain.value = 0.45;
        osc2.connect(osc2Gain).connect(filter);
        osc2.start(now);
        oscs.push(osc2);

        const osc3 = this.audioCtx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = freq / 2;
        const osc3Gain = this.audioCtx.createGain();
        osc3Gain.gain.value = 0.32;
        osc3.connect(osc3Gain).connect(filter);
        osc3.start(now);
        oscs.push(osc3);
        break;
      }

      case 'music_box': {
        noteGain.gain.linearRampToValueAtTime(0.8, now + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, now);
        filter.Q.value = 1.2;
        filter.connect(noteGain);

        const mbOsc = this.audioCtx.createOscillator();
        mbOsc.type = 'sine';
        mbOsc.frequency.value = freq;
        mbOsc.connect(filter);
        mbOsc.start(now);
        oscs.push(mbOsc);
        break;
      }

      case '8bit': {
        noteGain.gain.linearRampToValueAtTime(0.35, now + 0.01);
        noteGain.gain.setValueAtTime(0.35, now + 0.1);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(5000, now);
        filter.connect(noteGain);

        const retroOsc = this.audioCtx.createOscillator();
        retroOsc.type = 'square';
        retroOsc.frequency.value = freq;
        retroOsc.connect(filter);
        retroOsc.start(now);
        oscs.push(retroOsc);
        break;
      }
    }

    this.activeOscillators[note] = {
      oscs,
      gain: noteGain,
      instrument,
    };
  }

  public triggerNoteStop(note: string) {
    const audioData = this.activeOscillators[note];
    if (!audioData) return;

    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    try {
      audioData.gain.gain.cancelScheduledValues(now);
      audioData.gain.gain.setValueAtTime(audioData.gain.gain.value, now);

      let releaseTime = 0.15;
      if (['organ', 'synth_lead', '8bit', 'pinpeat'].includes(audioData.instrument)) {
        releaseTime = 0.05;
      } else if (audioData.instrument === 'electric_piano' || audioData.instrument === 'khloy') {
        releaseTime = 0.32;
      }

      audioData.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

      const oscList = audioData.oscs;
      setTimeout(() => {
        try {
          oscList.forEach(osc => {
             osc.stop();
             osc.disconnect();
          });
        } catch (_) {}
      }, (releaseTime + 0.05) * 1000);

    } catch (e) {
      console.error("Error stopping notes: ", e);
    }

    delete this.activeOscillators[note];
  }

  public stopAll() {
    Object.keys(this.activeOscillators).forEach(note => {
      this.triggerNoteStop(note);
    });
    this.activeOscillators = {};
  }
}
