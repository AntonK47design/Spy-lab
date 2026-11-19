/**
 * Save system on top of Bridge storage.
 *  - start: ONE storage.get with every key, missing keys -> defaults, migrations.
 *  - writes: only dirty keys, all in one storage.set, at most every SAVE.minIntervalMs,
 *    immediately on platform pause / tab hidden. Never per frame.
 */
import { SAVE } from '../config/save'
import { onFlushRequest } from './lifecycle'
import { storage } from '../platform/bridge'

export type SaveKey = (typeof SAVE.keys)[keyof typeof SAVE.keys]

type Slot = { version: number; data: Record<string, unknown> }

const slots = new Map<SaveKey, Slot>()
const dirty = new Set<SaveKey>()
let lastWrite = 0
let pending: ReturnType<typeof setTimeout> | null = null
let writing: Promise<void> | null = null
export const saveStats = { reads: 0, writes: 0, lastWriteKeys: [] as string[] }

function parse(raw: unknown): Slot | null {
  if (raw == null || raw === '') return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj && typeof obj === 'object' && 'data' in obj) {
      const o = obj as { v?: number; data: Record<string, unknown> }
      return { version: o.v ?? 1, data: o.data ?? {} }
    }
  } catch {
    /* corrupt slot -> defaults */
  }
  return null
}

export async function loadAll(): Promise<void> {
  const keys = Object.values(SAVE.keys) as SaveKey[]
  let values: unknown[] = []
  try {
    values = await storage.get(keys)
  } catch {
    values = keys.map(() => null)
  }
  saveStats.reads++
  keys.forEach((k, i) => {
    const slot = parse(values[i]) ?? { version: SAVE.version, data: {} }
    slots.set(k, migrate(k, slot))
  })
  onFlushRequest(() => void flush())
}

function migrate(_key: SaveKey, slot: Slot): Slot {
  // v1 is the first version: nothing to migrate yet. Future: switch on slot.version.
  return { version: SAVE.version, data: slot.data }
}

export function read<T extends Record<string, unknown>>(key: SaveKey, defaults: T): T {
  const data = slots.get(key)?.data ?? {}
  return { ...defaults, ...(data as Partial<T>) }
}

/** Replace a slot's data and schedule a throttled write. */
export function write(key: SaveKey, data: Record<string, unknown>, immediate = false): void {
  slots.set(key, { version: SAVE.version, data })
  dirty.add(key)
  if (immediate) void flush()
  else schedule()
}

function schedule(): void {
  if (pending) return
  const wait = Math.max(0, lastWrite + SAVE.minIntervalMs - Date.now())
  pending = setTimeout(() => {
    pending = null
    void flush()
  }, wait)
}

export async function flush(): Promise<void> {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  if (writing) await writing
  if (dirty.size === 0) return
  const keys = [...dirty]
  dirty.clear()
  const values = keys.map((k) => JSON.stringify({ v: SAVE.version, data: slots.get(k)?.data ?? {} }))
  lastWrite = Date.now()
  saveStats.writes++
  saveStats.lastWriteKeys = keys
  writing = storage.set(keys, values).catch(() => {
    for (const k of keys) dirty.add(k) // retry with the next write
  })
  await writing
  writing = null
}
