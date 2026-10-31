import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodePcm, speechFrames } from './read-aloud.ts'

test('speech frames survive arbitrary packet splits and release the reader', async () => {
  const bytes = new TextEncoder().encode('{"sampleRate":24000}\n\n{"audio":"AAAA"}\n{"done":true}')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })
  const frames = []
  for await (const frame of speechFrames(stream)) frames.push(frame)
  assert.deepEqual(frames, [{ sampleRate: 24000 }, { audio: 'AAAA' }, { done: true }])
  assert.equal(stream.locked, false)
})

test('invalid frames fail and PCM decodes signed little-endian samples', async () => {
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('broken\n')); c.close() } })
  await assert.rejects(async () => { for await (const frame of speechFrames(stream)) void frame })
  assert.equal(stream.locked, false)
  assert.deepEqual([...decodePcm(btoa(String.fromCharCode(0, 128, 0, 0, 255, 127)))], [-1, 0, 32767 / 32768])
  assert.throws(() => decodePcm('AA=='))
})
