/** Internal receipt-scoped undo journal for plain projection objects.
 * Array-valued entity fields are immutable: replace them when changing a value.
 * The only growing array, the effects log, uses append() to journal its length.
 */
const targets = new WeakMap<object, object>()

function raw<T>(value: T): T {
  return (
    value !== null && typeof value === 'object'
      ? (targets.get(value) ?? value)
      : value
  ) as T
}

/** Copy an individual entity without trying to structured-clone its journal proxy. */
export function copyEntity<T>(value: T): T {
  return structuredClone(raw(value))
}

export class ProjectionJournal {
  private readonly views = new WeakMap<object, object>()
  private readonly undo = new Map<
    object,
    Map<PropertyKey, PropertyDescriptor | undefined>
  >()
  private readonly deleted = new Map<object, Set<PropertyKey>>()

  private remember(target: object, key: PropertyKey): void {
    let fields = this.undo.get(target)
    if (!fields) this.undo.set(target, (fields = new Map()))
    if (!fields.has(key))
      fields.set(key, Object.getOwnPropertyDescriptor(target, key))
  }

  view<T extends object>(target: T): T {
    target = raw(target)
    const prior = this.views.get(target)
    if (prior) return prior as T
    const view = new Proxy(target, {
      get: (object, key) => {
        if (this.deleted.get(object)?.has(key)) return undefined
        const value: unknown = Reflect.get(object, key)
        return value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
          ? this.view(value)
          : value
      },
      set: (object, key, value: unknown) => {
        this.remember(object, key)
        this.deleted.get(object)?.delete(key)
        Object.defineProperty(object, key, {
          value: raw(value),
          writable: true,
          enumerable: true,
          configurable: true,
        })
        return true
      },
      deleteProperty: (object, key) => {
        if (!Object.hasOwn(object, key)) return true
        this.remember(object, key)
        let keys = this.deleted.get(object)
        if (!keys) this.deleted.set(object, (keys = new Set()))
        keys.add(key)
        // Delay physical deletion until commit, preserving key order on rollback.
        return true
      },
      has: (object, key) =>
        !this.deleted.get(object)?.has(key) && Reflect.has(object, key),
      ownKeys: (object) =>
        Reflect.ownKeys(object).filter(
          (key) => !this.deleted.get(object)?.has(key),
        ),
      getOwnPropertyDescriptor: (object, key) =>
        this.deleted.get(object)?.has(key)
          ? undefined
          : Object.getOwnPropertyDescriptor(object, key),
    })
    this.views.set(target, view)
    targets.set(view, target)
    return view
  }

  append<T>(array: T[], value: T): void {
    this.remember(array, 'length')
    array.push(value)
  }

  commit(): void {
    for (const [object, keys] of this.deleted)
      for (const key of keys) Reflect.deleteProperty(object, key)
  }

  rollback(): void {
    for (const [object, fields] of this.undo)
      for (const [key, descriptor] of [...fields].reverse()) {
        if (descriptor) Object.defineProperty(object, key, descriptor)
        else Reflect.deleteProperty(object, key)
      }
  }
}
