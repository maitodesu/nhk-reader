/**
 * A tiny localStorage-backed store for `useSyncExternalStore`. This is React's
 * own sanctioned way to read an external store (here, localStorage) without a
 * hydration mismatch: `getServerSnapshot` supplies the SSR-safe default so
 * server and first-client-render agree, and React itself (not an effect)
 * swaps in the real client value right after hydration — no manual
 * setState-in-effect dance, no eslint fight, no flash of mismatched markup.
 */
export function createPersistedStore<T>(
  key: string,
  serverValue: T,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string
) {
  const listeners = new Set<() => void>();

  function subscribe(callback: () => void) {
    listeners.add(callback);
    window.addEventListener("storage", callback);
    return () => {
      listeners.delete(callback);
      window.removeEventListener("storage", callback);
    };
  }

  function getSnapshot(): T {
    try {
      return parse(window.localStorage.getItem(key));
    } catch {
      return serverValue;
    }
  }

  function getServerSnapshot(): T {
    return serverValue;
  }

  function set(value: T) {
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch {
      // localStorage unavailable — the value still updates for this tab via listeners below.
    }
    listeners.forEach((l) => l());
  }

  return { subscribe, getSnapshot, getServerSnapshot, set };
}
