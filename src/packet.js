const PACKET_SIZE = 26
const SIGNATURE_SIZE = 8

const buildPacket = ({ senderId, amountPaise, timestampSec, nonce, signature }) => {
  const packet = new Uint8Array(PACKET_SIZE)
  const view = new DataView(packet.buffer)
  view.setUint32(0, senderId)
  view.setUint32(4, amountPaise)
  view.setUint32(8, timestampSec)
  view.setUint16(12, nonce)
  packet.set(signature, 14)
  return packet
}

const parsePacket = (packet) => {
  if (!(packet instanceof Uint8Array) || packet.length !== PACKET_SIZE) {
    throw new Error('Invalid packet length')
  }
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
  const senderId = view.getUint32(0)
  const amountPaise = view.getUint32(4)
  const timestampSec = view.getUint32(8)
  const nonce = view.getUint16(12)
  const signature = packet.slice(14, 14 + SIGNATURE_SIZE)
  return { senderId, amountPaise, timestampSec, nonce, signature }
}

const bytesToBits = (bytes) => {
  const output = []
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i]
    for (let bit = 7; bit >= 0; bit -= 1) {
      output.push((value >> bit) & 1)
    }
  }
  return output
}

const bitsToBytes = (bits) => {
  const byteCount = Math.floor(bits.length / 8)
  const output = new Uint8Array(byteCount)
  for (let i = 0; i < byteCount; i += 1) {
    let value = 0
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | bits[i * 8 + bit]
    }
    output[i] = value
  }
  return output
}

export {
  PACKET_SIZE,
  SIGNATURE_SIZE,
  buildPacket,
  parsePacket,
  bytesToBits,
  bitsToBytes,
}

