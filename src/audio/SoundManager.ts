/**
 * Procedural audio for Minr using Web Audio API.
 * All sounds are synthesized — no external audio files needed.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private musicPlaying = false;
  private footstepCooldown = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Sound Effects ---

  playBlockBreak(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Crunchy noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass for a "rocky" sound
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(now);
    source.stop(now + 0.15);
  }

  playBlockPlace(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Thud + click
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Click layer
    const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) {
      clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickData.length);
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    clickSrc.connect(clickGain).connect(this.sfxGain);
    clickSrc.start(now);
    clickSrc.stop(now + 0.03);
  }

  playFootstep(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Soft thump with slight pitch variation
    const pitch = 100 + Math.random() * 40;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    // Noise layer for texture
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length) * 0.3;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;

    osc.connect(gain).connect(filter).connect(this.sfxGain);
    noiseSrc.connect(noiseGain).connect(filter);
    osc.start(now);
    osc.stop(now + 0.08);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.05);
  }

  playJump(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Call each frame when the player is walking on the ground */
  updateFootsteps(dt: number, isMoving: boolean, isGrounded: boolean): void {
    this.footstepCooldown -= dt;
    if (isMoving && isGrounded && this.footstepCooldown <= 0) {
      this.playFootstep();
      this.footstepCooldown = 0.35; // interval between steps
    }
    if (!isMoving || !isGrounded) {
      this.footstepCooldown = 0;
    }
  }

  // --- Ambient Music ---

  startMusic(): void {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.playAmbientLoop();
  }

  stopMusic(): void {
    this.musicPlaying = false;
  }

  private playAmbientLoop(): void {
    if (!this.musicPlaying) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Calm ambient: layered slow pads with pentatonic notes
    const pentatonic = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const chordSize = 3;
    const duration = 8;
    const fadeTime = 2;

    // Pick random notes from the pentatonic scale
    const notes: number[] = [];
    for (let i = 0; i < chordSize; i++) {
      notes.push(pentatonic[Math.floor(Math.random() * pentatonic.length)]!);
    }

    for (const freq of notes) {
      // Main pad oscillator
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq / 2; // one octave down for warmth

      // Slight detuned layer for richness
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq / 2 + (Math.random() - 0.5) * 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + fadeTime);
      gain.gain.setValueAtTime(0.08, now + duration - fadeTime);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(filter).connect(this.musicGain);

      osc.start(now);
      osc.stop(now + duration);
      osc2.start(now);
      osc2.stop(now + duration);
    }

    // Schedule next chord
    setTimeout(() => this.playAmbientLoop(), (duration - 1) * 1000);
  }

  /** Toggle music on/off, returns new state */
  toggleMusic(): boolean {
    if (this.musicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }
}
