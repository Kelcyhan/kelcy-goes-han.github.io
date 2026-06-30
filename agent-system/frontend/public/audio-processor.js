/**
 * AudioWorklet processor: converts Float32 → Int16 PCM at 16kHz.
 * Runs on the audio rendering thread (off main thread).
 *
 * Handles any source sample rate (16kHz, 44.1kHz, 48kHz, etc.) by
 * resampling to 16kHz internally. This is critical for iOS Safari which
 * ignores the AudioContext sampleRate parameter and uses the device's
 * native rate (usually 48kHz).
 *
 * Includes speech-gated AGC (automatic gain control) that boosts quiet
 * mic signals to a target level suitable for cloud STT (Deepgram).
 * During silence the gain is frozen to avoid amplifying background noise.
 *
 * Output: 1600-sample (100ms) chunks of int16 PCM at 16kHz.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Output buffer: 1600 samples = 100ms at 16kHz → 3200 bytes
    this._buffer = new Int16Array(1600)
    this._pos = 0
    // Resampling: ratio of source rate to 16kHz target
    // sampleRate is a global provided by the AudioWorklet spec
    this._ratio = sampleRate / 16000
    this._srcOffset = 0 // fractional sample accumulator

    // ── AGC state ──
    this._gain = 3.0           // current gain (start at 3x as sensible default)
    this._targetRms = 0.1      // target RMS ~= -20 dBFS, good for STT
    this._silenceFloor = 0.005 // RMS below this = silence, freeze gain
    this._maxGain = 15.0       // max gain (avoid runaway amplification)
    this._minGain = 1.0        // never attenuate below 1x
    this._attackCoeff = 0.03   // fast attack — respond quickly to loud input
    this._releaseCoeff = 0.003 // slow release — don't drop gain during pauses
    // RMS is measured over resampled samples within each process() call

    // ── VAD state (voice activity detection) ──
    this._smoothRms = 0          // exponential moving average of RMS
    this._smoothCoeff = 0.15     // EMA smoothing factor — slower for stability
    this._vadSpeaking = false    // current speech state
    this._vadOnsetThresh = 0.01  // RMS above this → speech starts
    this._vadOffsetThresh = 0.006 // RMS below this → speech ends (hysteresis)
    this._silenceFrames = 0      // consecutive silent frames
    this._speechFrames = 0       // consecutive speech frames
    // Calculate delays in frames based on actual sample rate
    // process() receives 128 samples, so frame duration = 128 / sampleRate seconds
    const frameDurationMs = (128 / sampleRate) * 1000
    this._onsetDelay = Math.ceil(50 / frameDurationMs)    // ~50ms of speech to trigger onset
    this._offsetDelay = Math.ceil(1500 / frameDurationMs)  // ~1500ms of silence to trigger offset
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const samples = input[0]

    // ── Measure RMS of this frame (pre-gain, at source rate) ──
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / samples.length)

    // ── VAD: detect speech onset/offset with hysteresis ──
    this._smoothRms += (rms - this._smoothRms) * this._smoothCoeff
    const wasSpeaking = this._vadSpeaking
    if (!this._vadSpeaking) {
      if (this._smoothRms > this._vadOnsetThresh) {
        this._speechFrames++
        this._silenceFrames = 0
        if (this._speechFrames >= this._onsetDelay) {
          this._vadSpeaking = true
        }
      } else {
        this._speechFrames = 0
      }
    } else {
      if (this._smoothRms < this._vadOffsetThresh) {
        this._silenceFrames++
        this._speechFrames = 0
        if (this._silenceFrames >= this._offsetDelay) {
          this._vadSpeaking = false
        }
      } else {
        this._silenceFrames = 0
      }
    }
    if (this._vadSpeaking !== wasSpeaking) {
      this.port.postMessage({ type: 'vad', speaking: this._vadSpeaking })
    }

    // ── Update gain only during speech (RMS above silence floor) ──
    if (rms > this._silenceFloor) {
      const desiredGain = this._targetRms / rms
      const clampedDesired = Math.max(this._minGain, Math.min(this._maxGain, desiredGain))
      // Smooth: fast attack (gain decreasing = input got louder), slow release
      const coeff = clampedDesired < this._gain ? this._attackCoeff : this._releaseCoeff
      this._gain += (clampedDesired - this._gain) * coeff
    }
    // During silence: gain stays frozen at last value

    for (let i = 0; i < samples.length; i++) {
      this._srcOffset += 1
      if (this._srcOffset >= this._ratio) {
        this._srcOffset -= this._ratio

        // Apply gain, clamp, convert float32 [-1,1] → int16
        const amplified = Math.max(-1, Math.min(1, samples[i] * this._gain))
        this._buffer[this._pos++] = amplified < 0 ? amplified * 0x8000 : amplified * 0x7FFF

        if (this._pos >= this._buffer.length) {
          // Copy into a new ArrayBuffer for transfer
          const out = this._buffer.buffer.slice(0)
          this.port.postMessage(out, [out])
          this._buffer = new Int16Array(1600)
          this._pos = 0
        }
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
