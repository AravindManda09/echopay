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
  console.log('[DEBUG-SIGNER] Verifying signature for payload:', Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' '))
  console.log('[DEBUG-SIGNER] Expected signature:', Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(' '))
  const expected = await signData(payload)
  console.log('[DEBUG-SIGNER] Computed signature:', Array.from(expected).map(b => b.toString(16).padStart(2, '0')).join(' '))
  if (expected.length !== signature.length) {
    console.log('[DEBUG-SIGNER] Length mismatch:', expected.length, 'vs', signature.length)
    return false
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== signature[i]) {
      console.log('[DEBUG-SIGNER] Byte mismatch at index', i, ':', expected[i], 'vs', signature[i])
      return false
    }
  }
  console.log('[DEBUG-SIGNER] Signature verification PASSED')
  return true
}

export { SIGNATURE_SIZE, signData, verifySignature }

