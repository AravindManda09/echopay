const startDecoder = async (options = {}) => {
  const bitDuration = options.bitDuration ?? 0.03
  const onBit = options.onBit ?? (() => {})
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 4096
  analyser.smoothingTimeConstant = 0.1
  source.connect(analyser)

  const buffer = new Float32Array(analyser.frequencyBinCount)
  const sampleRate = context.sampleRate
  const binSize = sampleRate / analyser.fftSize

  const sample = () => {
    analyser.getFloatFrequencyData(buffer)
    let maxIndex = 0
    let maxValue = -Infinity
    for (let i = 0; i < buffer.length; i += 1) {
      if (buffer[i] > maxValue) {
        maxValue = buffer[i]
        maxIndex = i
      }
    }
    const dominantFreq = maxIndex * binSize
    // Dominant frequency above 19 kHz maps to bit 1, else bit 0.
    const bit = dominantFreq > 19000 ? 1 : 0
    onBit(bit)
  }

  const interval = setInterval(sample, bitDuration * 1000)

  const stop = async () => {
    clearInterval(interval)
    stream.getTracks().forEach((track) => track.stop())
    await context.close()
  }

  return { stop }
}

export { startDecoder }

