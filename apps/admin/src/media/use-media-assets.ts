import { useEffect, useState } from 'react'
import { formatApiError } from '../api/error'
import { listMediaAssets, type MediaAssetSummary } from '../api/media'

export type MediaAssetsState = {
  assets: MediaAssetSummary[]
  error: string | null
}

/** The scenario's media library, for slot and trigger pickers. */
export function useMediaAssets(scenarioId: string): MediaAssetsState {
  const [state, setState] = useState<MediaAssetsState>({ assets: [], error: null })
  useEffect(() => {
    let active = true
    listMediaAssets(scenarioId)
      .then((assets) => {
        if (active) setState({ assets, error: null })
      })
      .catch((error: unknown) => {
        if (active) setState({ assets: [], error: formatApiError(error, 'Failed to load media') })
      })
    return () => {
      active = false
    }
  }, [scenarioId])
  return state
}
