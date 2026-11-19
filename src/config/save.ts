export const SAVE = {
  version: 1,
  keys: {
    core: 'spylab_v1_core',
    agents: 'spylab_v1_agents',
    progress: 'spylab_v1_progress',
    meta: 'spylab_v1_meta',
    settings: 'spylab_v1_settings',
  },
  /** Throttle: at most one storage.set per this interval (flushes on pause/hide ignore it). */
  minIntervalMs: 10_000,
} as const
