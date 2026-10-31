export type SpeechFrame = { sampleRate?: number; audio?: string; done?: boolean; error?: string }

/** Network packets can split JSON anywhere, including inside an audio frame. */
export async function* speechFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SpeechFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      let end: number
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end)
        pending = pending.slice(end + 1)
        if (line.trim()) yield JSON.parse(line) as SpeechFrame
      }
      if (done) break
    }
    if (pending.trim()) yield JSON.parse(pending) as SpeechFrame
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function decodePcm(encoded: string): Float32Array<ArrayBuffer> {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
  if (bytes.length % 2) throw new Error('Invalid local audio stream.')
  const view = new DataView(bytes.buffer)
  return Float32Array.from({ length: bytes.length / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768)
}
