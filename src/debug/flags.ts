const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()

/** Debug hooks + dev ad simulator: only in dev builds or with ?debug=1. */
export const DEBUG: boolean = import.meta.env.DEV || params.get('debug') === '1'

/**
 * Dev ad simulator mode (DEBUG only):
 *  default 'on'; ?adsim=off uses the real Bridge; ?adsim=unsupported reports no ad support.
 */
export const AD_SIM: 'off' | 'on' | 'unsupported' = !DEBUG
  ? 'off'
  : params.get('adsim') === 'off'
    ? 'off'
    : params.get('adsim') === 'unsupported'
      ? 'unsupported'
      : 'on'
