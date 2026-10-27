// Stand-in for next/headers' cookies() so route handlers and lib/auth can be
// exercised outside a real request. Tests mock next/headers with this:
//   vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);

export interface SetCall {
  name: string;
  value: string;
  options: Record<string, unknown>;
}
export interface DeleteCall {
  name: string;
  path?: string;
}

export const jar = {
  values: new Map<string, string>(),
  sets: [] as SetCall[],
  deletes: [] as DeleteCall[],
};

export function resetJar(initial: Record<string, string> = {}) {
  jar.values = new Map(Object.entries(initial));
  jar.sets = [];
  jar.deletes = [];
}

const store = {
  get(name: string) {
    const value = jar.values.get(name);
    return value === undefined ? undefined : { name, value };
  },
  getAll() {
    return [...jar.values].map(([name, value]) => ({ name, value }));
  },
  has(name: string) {
    return jar.values.has(name);
  },
  set(name: string, value: string, options: Record<string, unknown> = {}) {
    jar.sets.push({ name, value, options });
    jar.values.set(name, value);
    return store;
  },
  delete(arg: string | { name: string; path?: string }) {
    const call = typeof arg === "string" ? { name: arg } : arg;
    jar.deletes.push(call);
    jar.values.delete(call.name);
    return store;
  },
};

export const nextHeadersMock = {
  cookies: async () => store,
  headers: async () => new Headers(),
};

export function lastSet(name: string) {
  return [...jar.sets].reverse().find((s) => s.name === name);
}
