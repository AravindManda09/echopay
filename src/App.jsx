import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { buildPacket, bytesToBits, bitsToBytes, parsePacket, PACKET_SIZE } from './packet'
import { signData, verifySignature } from './signer'
import { playBits } from './encoder'
import { startDecoder } from './decoder'

const BIT_DURATION_SEC = 0.03
const PREAMBLE_BITS = [1, 0, 1, 0, 1, 0, 1, 0]
const MAX_PACKET_AGE_SEC = 10
const ACCOUNT_KEY = 'echopay-account'

const loadAccount = () => {
  const raw = localStorage.getItem(ACCOUNT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.userId !== 'number' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.balance !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const saveAccount = (account) => {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
}

const buildPayload = ({ senderId, amountPaise, timestampSec, nonce }) => {
  const payload = new Uint8Array(14)
  const view = new DataView(payload.buffer)
  view.setUint32(0, senderId)
  view.setUint32(4, amountPaise)
  view.setUint32(8, timestampSec)
  view.setUint16(12, nonce)
  return payload
}

const validatePacket = async (packet) => {
  const { senderId, amountPaise, timestampSec, nonce, signature } = parsePacket(packet)
  const payload = packet.slice(0, 14)
  const isValid = await verifySignature(payload, signature)
  if (!isValid) {
    throw new Error('Invalid signature')
  }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestampSec) > MAX_PACKET_AGE_SEC) {
    throw new Error('Stale timestamp')
  }
  return { senderId, amountPaise, timestampSec, nonce }
}

function App() {
  const [mode, setMode] = useState('send')
  const [amountInput, setAmountInput] = useState('125.00')
  const [sendStatus, setSendStatus] = useState('')
  const [listening, setListening] = useState(false)
  const [received, setReceived] = useState(null)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [usernameInput, setUsernameInput] = useState('')
  const audioContextRef = useRef(null)
  const decoderRef = useRef(null)
  const bitBufferRef = useRef([])
  const balance = account?.balance ?? 0
  const userId = account?.userId ?? 0

  useEffect(() => {
    const stored = loadAccount()
    if (stored) {
      setAccount(stored)
      setUsernameInput(stored.username)
    }
    return () => {
      stopListening()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const handleSend = async () => {
    setError('')
    setSendStatus('')
    const amountValue = Number.parseFloat(amountInput)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a valid amount.')
      return
    }
    const amountPaise = Math.round(amountValue * 100)
    if (!account) {
      setError('Create an account first.')
      return
    }
    if (balance < amountValue) {
      setError('Insufficient balance.')
      return
    }
    try {
      const timestampSec = Math.floor(Date.now() / 1000)
      const nonce = crypto.getRandomValues(new Uint16Array(1))[0]
      const payload = buildPayload({ senderId: userId, amountPaise, timestampSec, nonce })
      const signature = await signData(payload)
      const packet = buildPacket({
        senderId: userId,
        amountPaise,
        timestampSec,
        nonce,
        signature,
      })
      // Add a short preamble and a small gap between bits to improve sync.
      const bits = [...PREAMBLE_BITS, ...bytesToBits(packet)]
      setSendStatus('Sending...')
      await playBits(bits, { bitDuration: BIT_DURATION_SEC, gapDuration: 0.004 }, audioContextRef)
      setSendStatus('Sent via sound.')
      const updated = { ...account, balance: account.balance - amountValue }
      setAccount(updated)
      saveAccount(updated)
    } catch (err) {
      setError(err.message || 'Send failed.')
    }
  }

  const stopListening = async () => {
    if (decoderRef.current) {
      await decoderRef.current.stop()
      decoderRef.current = null
    }
    bitBufferRef.current = []
    setListening(false)
  }

  const startListening = async () => {
    if (listening) return
    setError('')
    setReceived(null)
    try {
      decoderRef.current = await startDecoder({
        bitDuration: BIT_DURATION_SEC,
        onBit: (bit) => {
          const buffer = bitBufferRef.current
          buffer.push(bit)
          const neededBits = PREAMBLE_BITS.length + PACKET_SIZE * 8
          if (buffer.length < neededBits) return
          for (let i = 0; i <= buffer.length - neededBits; i += 1) {
            const match = PREAMBLE_BITS.every(
              (bitValue, idx) => buffer[i + idx] === bitValue,
            )
            if (!match) continue
            const packetStart = i + PREAMBLE_BITS.length
            const packetBits = buffer.slice(packetStart, packetStart + PACKET_SIZE * 8)
            if (packetBits.length < PACKET_SIZE * 8) return
            const packet = bitsToBytes(packetBits)
            stopListening()
            validatePacket(packet)
              .then((data) => {
                setReceived(data)
                setError('')
                if (account) {
                  const updated = {
                    ...account,
                    balance: account.balance + data.amountPaise / 100,
                  }
                  setAccount(updated)
                  saveAccount(updated)
                }
              })
              .catch((err) => setError(err.message || 'Invalid packet'))
            return
          }
          if (buffer.length > neededBits * 2) {
            buffer.splice(0, buffer.length - neededBits * 2)
          }
        },
      })
      setListening(true)
    } catch (err) {
      setError('Microphone permission denied.')
    }
  }

  const handleCreateAccount = () => {
    setError('')
    const username = usernameInput.trim()
    if (!username) {
      setError('Enter a username.')
      return
    }
    const newAccount = {
      userId: crypto.getRandomValues(new Uint32Array(1))[0],
      username,
      balance: 500,
    }
    // Demo-only account system.
    setAccount(newAccount)
    saveAccount(newAccount)
  }

  const handleResetAccount = () => {
    localStorage.removeItem(ACCOUNT_KEY)
    setAccount(null)
    setUsernameInput('')
    setReceived(null)
    setError('')
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>EchoPay</h1>
          <p>Offline sound-based payments via Web Audio FSK.</p>
        </div>
        {account && <div className="badge">User ID: {userId}</div>}
      </header>

      {!account && (
        <section className="card">
          <h2>Create Account</h2>
          <p className="hint">Demo-only account system.</p>
          <label className="field">
            Username
            <input
              type="text"
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              placeholder="Enter a name"
            />
          </label>
          <button className="primary" onClick={handleCreateAccount}>
            Create Account
          </button>
        </section>
      )}

      {account && (
        <section className="card summary">
          <div>
            <h2>{account.username}</h2>
            <p className="balance">Balance ₹{balance.toFixed(2)}</p>
          </div>
          <button className="ghost" onClick={handleResetAccount}>
            Reset Account
          </button>
        </section>
      )}

      <section className="mode-switch">
        <button
          className={mode === 'send' ? 'active' : ''}
          onClick={() => {
            setMode('send')
            stopListening()
          }}
        >
          Send
        </button>
        <button
          className={mode === 'receive' ? 'active' : ''}
          onClick={() => {
            setMode('receive')
            startListening()
          }}
        >
          Receive
        </button>
      </section>

      {mode === 'send' && (
        <section className="card">
          <h2>Send via Sound</h2>
          <label className="field">
            Amount (INR)
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
            />
          </label>
          <button className="primary" onClick={handleSend}>
            Send via Sound
          </button>
          {sendStatus && <p className="status">{sendStatus}</p>}
        </section>
      )}

      {mode === 'receive' && (
        <section className="card">
          <h2>Receive</h2>
          <p className="hint">Tip: use two devices to see different sender IDs.</p>
          {listening ? (
            <div className="listening">
              <span className="dot" />
              Listening...
            </div>
          ) : (
            <button className="primary" onClick={startListening}>
              Start Listening
            </button>
          )}
          {received && (
            <div className="success">
              <h3>Payment received</h3>
              <p>
                From {received.senderId} • ₹{(received.amountPaise / 100).toFixed(2)}
              </p>
              <p>Nonce {received.nonce}</p>
            </div>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default App
