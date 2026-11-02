import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square, Volume2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { decodePcm, speechFrames } from '@/lib/read-aloud'

type Session = { context: AudioContext; abort: AbortController }
type Status = 'idle' | 'loading' | 'playing' | 'paused'
const START_EVENT = 'notes-read-aloud-start'

export function ReadAloudControls({ getText }: { getText: () => string }) {
  const session = useRef<Session | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')

  function stop() {
    const current = session.current
    session.current = null
    current?.abort.abort()
    void current?.context.close().catch(() => {})
    setStatus('idle')
  }

  useEffect(() => {
    window.addEventListener(START_EVENT, stop)
    return () => {
      window.removeEventListener(START_EVENT, stop)
      const current = session.current
      session.current = null
      current?.abort.abort()
      void current?.context.close().catch(() => {})
    }
  }, [])

  async function start() {
    window.dispatchEvent(new Event(START_EVENT))
    setError('')
    const text = getText().trim()
    if (!text) { setError('This note has no text to read.'); return }
    if (text.length > 100_000) { setError('This note is too long to read aloud (100,000 characters maximum).'); return }
    let current: Session | null = null
    try {
      current = { context: new AudioContext(), abort: new AbortController() }
      session.current = current
      setStatus('loading')
      await current.context.resume()
      const { context, abort } = current
      const response = await fetch('http://127.0.0.1:49325/speech', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), signal: abort.signal,
      }).catch(() => { throw new Error('Local voice service is unavailable. Start it and try again.') })
      if (response.status === 409) throw new Error('The local voice is busy. Stop the other reader and try again.')
      if (!response.ok || !response.body) throw new Error('The local voice could not read this note. Check the service and retry.')
      let sampleRate = 0
      let nextTime = context.currentTime
      let received = false
      let completed = false
      for await (const frame of speechFrames(response.body)) {
        if (abort.signal.aborted) return
        if (frame.error) throw new Error(frame.error)
        if (frame.sampleRate) sampleRate = frame.sampleRate
        if (frame.done) { completed = true; break }
        if (!frame.audio) continue
        if (!(sampleRate >= 8000 && sampleRate <= 96000)) throw new Error('Invalid local audio stream.')
        // Keep at most two seconds queued, including while playback is paused.
        while (nextTime - context.currentTime > 2) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          if (abort.signal.aborted) return
        }
        const samples = decodePcm(frame.audio)
        if (!samples.length) continue
        const buffer = context.createBuffer(1, samples.length, sampleRate)
        buffer.copyToChannel(samples, 0)
        const source = context.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = speed
        source.connect(context.destination)
        nextTime = Math.max(nextTime, context.currentTime + 0.03)
        source.start(nextTime)
        nextTime += buffer.duration / speed
        if (!received) { received = true; setStatus('playing') }
      }
      if (!received || !completed) throw new Error('The local audio stream ended early. Please try again.')
      while (context.currentTime < nextTime) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        if (abort.signal.aborted) return
      }
    } catch (cause) {
      if (session.current !== current) return
      setError(cause instanceof Error ? cause.message : 'Could not play local audio. Please try again.')
    } finally {
      if (session.current === current) stop()
    }
  }

  async function togglePause() {
    const current = session.current
    if (!current) return
    try {
      if (status === 'paused') await current.context.resume()
      else await current.context.suspend()
      if (session.current === current) setStatus(status === 'paused' ? 'playing' : 'paused')
    } catch {
      if (session.current !== current) return
      stop()
      setError('Audio playback was interrupted. Please try again.')
    }
  }

  const active = status !== 'idle'
  return (
    <div className="grid min-h-7 gap-2">
      <div role="group" aria-label="Read aloud" className={`flex flex-wrap items-center gap-2${active
        ? ' read-aloud-floating fixed z-30 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-2'
        : ''}`}>
        <Button variant="outline" size="sm" disabled={status === 'loading'}
          onClick={() => void (active ? togglePause() : start())}>
          {status === 'paused' ? <Play /> : status === 'playing' ? <Pause /> : <Volume2 />}
          {status === 'loading' ? 'Preparing voice…' : status === 'paused' ? 'Resume' : status === 'playing' ? 'Pause' : 'Read aloud'}
        </Button>
        {active && <Button variant="ghost" size="sm" onClick={stop}><Square />Stop</Button>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span id="read-aloud-speed">Speed</span>
          <Select value={String(speed)} disabled={active} onValueChange={(value) => setSpeed(Number(value))}>
            <SelectTrigger size="sm" aria-labelledby="read-aloud-speed" title={active ? 'Stop reading to change speed' : 'Reading speed'} className="min-w-18 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="min-w-24">
              {[0.75, 1, 1.25, 1.5, 2].map((value) => <SelectItem key={value} value={String(value)} className="text-xs">{value}×</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span role="status" className="sr-only">{status === 'loading' ? 'Preparing local voice' : status === 'playing' ? 'Reading aloud' : status === 'paused' ? 'Reading paused' : ''}</span>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
