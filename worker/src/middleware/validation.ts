import { Context } from 'hono'
import { ZodSchema, ZodError } from 'zod'

export async function parseBody<T>(c: Context, schema: ZodSchema<T>): Promise<T | Response> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    const errors = (result.error as ZodError).errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }))
    return c.json({ error: 'Validation failed', details: errors }, 400)
  }

  return result.data
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}
