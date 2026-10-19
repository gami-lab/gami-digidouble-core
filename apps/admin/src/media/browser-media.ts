export type VideoMetadata = {
  durationMs: number | null
  poster: Blob | null
}

/**
 * Reads a local video's duration and captures one frame as a JPEG poster. Core never processes
 * media, so this happens in the author's browser; either value is `null` when the browser cannot
 * decode the file.
 */
export async function readVideoMetadata(file: Blob): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = url
  try {
    await waitFor(video, 'loadeddata')
    const durationMs = await readDurationMs(video)
    video.currentTime = Math.min(1, video.duration / 2)
    await waitFor(video, 'seeked')
    return { durationMs, poster: await captureFrame(video) }
  } catch {
    return { durationMs: null, poster: null }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Recorded WebM files often report an infinite duration until the browser seeks to the end. */
async function readDurationMs(video: HTMLVideoElement): Promise<number | null> {
  if (!Number.isFinite(video.duration)) {
    video.currentTime = Number.MAX_SAFE_INTEGER
    await waitFor(video, 'seeked')
  }
  return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null
}

function waitFor(video: HTMLVideoElement, event: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    video.addEventListener(
      event,
      () => {
        resolve()
      },
      { once: true },
    )
    video.addEventListener(
      'error',
      () => {
        reject(new Error('video decode failed'))
      },
      { once: true },
    )
  })
}

function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (context === null || canvas.width === 0) return Promise.resolve(null)
  context.drawImage(video, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  })
}
