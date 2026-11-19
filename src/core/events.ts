type Handler<T> = (payload: T) => void

/** Tiny typed event bus. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {}

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    const list = (this.handlers[name] ??= [])
    list.push(fn)
    return () => {
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
    }
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    const list = this.handlers[name]
    if (!list) return
    for (const fn of list.slice()) fn(payload)
  }
}
