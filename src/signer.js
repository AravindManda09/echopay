const SIGNATURE_SIZE = 8
const SECRET_KEY = 'ECHOPAY_DEMO_SECRET'

const concatBytes = (a, b) => {
  const output = new Uint8Array(a.length + b.length)
  output.set(a, 0)
  output.set(b, a.length)
  return output
}

const signData = async (payload) => {
  const secretBytes = new TextEncoder().encode(SECRET_KEY)
  const data = concatBytes(payload, secretBytes)
  const hash = await crypto.subtle.digest('SHA-256', data.buffer)
  return new Uint8Array(hash).slice(0, SIGNATURE_SIZE)
}

const verifySignature = async (payload, signature) => {
  const expected = await signData(payload)
  if (expected.length !== signature.length) return false
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== signature[i]) return false
  }
  return true
}

export { SIGNATURE_SIZE, signData, verifySignature }

