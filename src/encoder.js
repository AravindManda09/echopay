const FREQ_0 = 18500
const FREQ_1 = 19500

const ensureContext = async (contextRef) => {
  if (!contextRef.current) {
    contextRef.current = new AudioContext()
  }
  if (contextRef.current.state === 'suspended') {
    await contextRef.current.resume()
  }
  return contextRef.current
}

const playBits = async (bits, options = {}, contextRef) => {
  const ctx = await ensureContext(contextRef)
  const bitDuration = options.bitDuration ?? 0.03
  const gapDuration = options.gapDuration ?? 0.004
  const fade = Math.min(0.004, bitDuration / 4)
  const startAt = ctx.currentTime + 0.05

  bits.forEach((bit, index) => {
    const frequency = bit === 1 ? FREQ_1 : FREQ_0
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const time = startAt + index * (bitDuration + gapDuration)

    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.6, time + fade)
    gain.gain.setValueAtTime(0.6, time + bitDuration - fade)
    gain.gain.linearRampToValueAtTime(0, time + bitDuration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + bitDuration)
  })

  const totalDuration = bits.length * (bitDuration + gapDuration)
  return new Promise((resolve) => {
    setTimeout(resolve, totalDuration * 1000 + 120)
  })
}

export { playBits }

