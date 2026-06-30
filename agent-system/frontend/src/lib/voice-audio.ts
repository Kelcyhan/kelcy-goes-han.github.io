/**
 * Voice audio manager — mic capture + TTS playback for the voice layer.
 *
 * Mic capture: getUserMedia → AudioContext(16kHz) → AudioWorklet(pcm-processor)
 *              → PCM int16 chunks → onChunk callback (sends over WebSocket)
 *
 * TTS playback: receives PCM int16 chunks (24kHz) from server
 *               → AudioBuffer → scheduled playback via Web Audio API
 *               → supports barge-in interruption
 */

export class VoiceAudioManager {
  private captureCtx: AudioContext | null = null
  private playbackCtx: AudioContext | null = null
  private worklet: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private scheduledSources: AudioBufferSourceNode[] = []
  private nextPlayTime = 0
  private playing = false

  /**
   * Initialize the playback context. Must be called from a user gesture
   * (button click) on mobile browsers.
   */
  async init(): Promise<void> {
    this.playbackCtx = new AudioContext()
    if (this.playbackCtx.state === 'suspended') {
      await this.playbackCtx.resume()
    }
  }

  /**
   * Start mic capture and call onChunk with PCM ArrayBuffers.
   * Reuses the existing audio-processor.js worklet (16kHz, int16, 100ms chunks).
   */
  async startCapture(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    // Get microphone
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // AudioContext — let browser pick native rate; worklet resamples to 16kHz
    this.captureCtx = new AudioContext()
    await this.captureCtx.audioWorklet.addModule('/audio-processor.js')

    this.source = this.captureCtx.createMediaStreamSource(this.stream)
    this.worklet = new AudioWorkletNode(this.captureCtx, 'pcm-processor')

    this.worklet.port.onmessage = (e: MessageEvent) => {
      onChunk(e.data as ArrayBuffer)
    }

    this.source.connect(this.worklet)
    // Connect to destination to keep worklet running
    this.worklet.connect(this.captureCtx.destination)
  }

  /**
   * Enable TTS playback. Call before enqueuing chunks.
   */
  startPlayback(): void {
    this.playing = true
    this.nextPlayTime = 0
  }

  /**
   * Enqueue a PCM int16 chunk (24kHz) for playback.
   * Chunks are scheduled seamlessly using Web Audio API timing.
   */
  playChunk(pcm16: ArrayBuffer): void {
    if (!this.playbackCtx || !this.playing) return

    const int16 = new Int16Array(pcm16)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    const buffer = this.playbackCtx.createBuffer(1, float32.length, 24000)
    buffer.getChannelData(0).set(float32)

    const source = this.playbackCtx.createBufferSource()
    source.buffer = buffer
    source.connect(this.playbackCtx.destination)

    const now = this.playbackCtx.currentTime
    const startTime = Math.max(now + 0.02, this.nextPlayTime)
    source.start(startTime)
    this.nextPlayTime = startTime + buffer.duration

    this.scheduledSources.push(source)
    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source)
      if (idx >= 0) this.scheduledSources.splice(idx, 1)
    }
  }

  /**
   * Immediately stop all TTS playback (barge-in).
   */
  interruptPlayback(): void {
    this.playing = false
    for (const src of this.scheduledSources) {
      try { src.stop() } catch { /* already stopped */ }
    }
    this.scheduledSources = []
    this.nextPlayTime = 0
  }

  /**
   * End TTS playback gracefully (let scheduled buffers finish).
   */
  endPlayback(): void {
    this.playing = false
  }

  /**
   * Full cleanup — stop mic, stop playback, close contexts.
   */
  stop(): void {
    this.interruptPlayback()

    if (this.worklet) {
      this.worklet.disconnect()
      this.worklet = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    if (this.captureCtx) {
      this.captureCtx.close().catch(() => {})
      this.captureCtx = null
    }
    if (this.playbackCtx) {
      this.playbackCtx.close().catch(() => {})
      this.playbackCtx = null
    }
  }
}
