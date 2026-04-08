export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  SETUP_SECRET: string
}

export interface User {
  id: string
  email: string
  role: 'admin'
}

/** Generate a ULID-like sortable ID using the current timestamp + random suffix */
export function newId(): string {
  const ts = Date.now().toString(36).padStart(9, '0')
  const rand = Math.random().toString(36).slice(2, 11).padStart(9, '0')
  return `${ts}${rand}`
}

/** Run a D1 query and return all rows */
export async function query<T>(
  db: D1Database,
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql)
  const result = await stmt.bind(...params).all<T>()
  return result.results ?? []
}

/** Run a D1 query and return first row or null */
export async function queryOne<T>(
  db: D1Database,
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql)
  const result = await stmt.bind(...params).first<T>()
  return result ?? null
}

/** Run a D1 statement (INSERT/UPDATE/DELETE) */
export async function execute(
  db: D1Database,
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run()
}
