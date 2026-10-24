/**
 * ── API Validation Schemas ──────────────────────────────────────────────────
 *
 * Zod schemas for all API request bodies.
 * Import and use in edge route handlers to enforce strict input validation.
 */

import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────────────────

/** Sanitizes a string by stripping HTML tags and trimming whitespace */
const safeString = (max: number) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .transform((s) => s.trim().replace(/<[^>]*>/g, ''));

const entryId = z
  .string()
  .uuid({ message: 'id must be a valid UUID' });

// ── Category validation ───────────────────────────────────────────────────────

/**
 * Categories are either a known system slug or a user-defined string (max 60 chars).
 * Multi-category values are comma-separated.
 */
const categoryString = z
  .string()
  .max(120, 'Category must be at most 120 characters')
  .transform((s) => s.trim().replace(/<[^>]*>/g, ''))
  .refine(
    (s) => s.split(',').every((c) => c.trim().length > 0 && c.trim().length <= 60),
    { message: 'Each category segment must be 1–60 characters' }
  );

// ── Entry schemas ─────────────────────────────────────────────────────────────

export const CreateEntrySchema = z.object({
  content: safeString(8000).refine((s) => s.length > 0, { message: 'content is required' }),
  category: categoryString.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

export const UpdateEntrySchema = z
  .object({
    id: entryId,
    content: safeString(8000).optional(),
    category: categoryString.optional(),
    metric_override: z
      .object({
        key: z.string().max(64),
        value: z.number().finite(),
      })
      .optional(),
  })
  .refine(
    (d) => d.content !== undefined || d.category !== undefined || d.metric_override !== undefined,
    { message: 'At least one of content, category, or metric_override is required' }
  );

export type UpdateEntryInput = z.infer<typeof UpdateEntrySchema>;

export const DeleteEntriesSchema = z.object({
  ids: z
    .array(entryId)
    .min(1, 'At least one id is required')
    .max(100, 'Cannot delete more than 100 entries at once'),
});

export type DeleteEntriesInput = z.infer<typeof DeleteEntriesSchema>;

// ── Profile schemas ───────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  display_name: safeString(80).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ── Category schemas ──────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: safeString(60).refine((s) => s.length > 0, { message: 'name is required' }),
  icon: z.string().max(4).optional(),
  color: z.string().max(30).optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

// ── Pagination helpers ────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
  category: z.string().max(120).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ── Validation helper ─────────────────────────────────────────────────────────

/**
 * Parse and validate an API request body against a Zod schema.
 * Returns `{ success: true, data }` or `{ success: false, error: Response }`.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      error: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return {
      success: false,
      error: new Response(JSON.stringify({ error: 'Validation failed', issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { success: true, data: result.data };
}
