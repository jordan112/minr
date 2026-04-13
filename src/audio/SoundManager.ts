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

  /** Must be called from a user gesture (click/keydown) to unlock audio on Safari */
  init(): void {
    if (this.ctx) return;

    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);

      // Resume if suspended (Safari)
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      // Silent buffer to fully unlock on Safari/iOS
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);

      console.log("Audio initialized, state:", this.ctx.state);
    } catch (e) {
      console.warn("Failed to init audio:", e);
    }
  }

  private getCtx(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Sound Effects ---

  playBlockBreak(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Crunchy noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

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
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Thud
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

    // Click
    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) {
      clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickData.length);
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    clickSrc.connect(clickGain).connect(this.sfxGain);
    clickSrc.start(now);
    clickSrc.stop(now + 0.03);
  }

  playFootstep(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pitch = 100 + Math.random() * 40;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length) * 0.3;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
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
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // --- Animal Sounds ---

  playCow(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // "Moo" — low frequency sweep up then down
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.3);
    osc.frequency.linearRampToValueAtTime(130, now + 0.8);
    osc.frequency.linearRampToValueAtTime(100, now + 1.0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.setValueAtTime(0.15, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    osc.connect(gain).connect(filter).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  playPig(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // "Oink" — short nasal burst
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.2;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(250 + Math.random() * 50, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 500;
      filter.Q.value = 3;

      osc.connect(filter).connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  playSheep(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // "Baa" — vibrato tone
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(350, now + 0.15);
    osc.frequency.linearRampToValueAtTime(280, now + 0.5);

    // Vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.setValueAtTime(0.1, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 2;

    osc.connect(gain).connect(filter).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playSplash(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.3);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.3);
  }

  updateFootsteps(dt: number, isMoving: boolean, isGrounded: boolean): void {
    this.footstepCooldown -= dt;
    if (isMoving && isGrounded && this.footstepCooldown <= 0) {
      this.playFootstep();
      this.footstepCooldown = 0.35;
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
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pentatonic = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const chordSize = 3;
    const duration = 8;
    const fadeTime = 2;

    const notes: number[] = [];
    for (let i = 0; i < chordSize; i++) {
      notes.push(pentatonic[Math.floor(Math.random() * pentatonic.length)]!);
    }

    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq / 2;

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

    setTimeout(() => this.playAmbientLoop(), (duration - 1) * 1000);
  }

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
