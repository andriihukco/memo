export const runtime = "nodejs";

import { classifyAudio, ClassificationError } from "@/lib/classifier";
import { getEffectiveTier, TIER_INFO } from "@/lib/stars/paywall";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateMedia, storagePath, type MediaKind } from "@/lib/media";
import { bearerOf, profileIdOf, sealText, serviceClient, userClient } from "@/lib/entry-api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Audio note. The recording is transcribed and classified the same way as a typed entry: the words
 * become entries, numbers become metrics, and the recording is kept as a private attachment.
 */
export async function POST(req: Request): Promise<Response> {
  const jwt = bearerOf(req);
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const rl = await rateLimit(`entries:audio:${jwt.slice(0, 16)}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const supabase = userClient(jwt);
  const userId = await profileIdOf(supabase);
  if (!userId) return json({ error: "Profile not found" }, 404);

  const tier = await getEffectiveTier(userId);
  const limits = TIER_INFO[tier].limits;
  const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (limits.entries !== Infinity && (count ?? 0) >= limits.entries) {
    return json({ error: "limit_exceeded", feature: "entries", limit: limits.entries, current: count }, 402);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "file is required" }, 400);
  const durationS = Number(form.get("duration_s") ?? 0);
  const mime = file.type || "audio/webm";
  const refused = validateMedia("audio" satisfies MediaKind, mime, file.size, durationS);
  if (refused) return json({ error: refused }, refused === "unsupported_type" ? 415 : 413);

  const buffer = Buffer.from(await file.arrayBuffer());
  let result;
  try {
    result = await classifyAudio(buffer, mime, undefined, []);
  } catch (err) {
    if (err instanceof ClassificationError) return json({ error: "classification_failed" }, 422);
    throw err;
  }

  // Questions and chat get an answer, not an entry.
  if (result.intent !== "save_entry") {
    return json({ intent: result.intent, answer: result.content });
  }

  const payloads = result.entries.length
    ? result.entries
    : [{ content: result.content, category: result.category, metadata: {}, dashboard_metrics: [] }];

  const saved: { id: string; content: string; category: string; metadata: Record<string, unknown>; created_at: string }[] = [];
  for (const [index, p] of payloads.entries()) {
    const { data, error } = await supabase
      .from("entries")
      .insert({
        user_id: userId,
        content: await sealText(jwt, p.content.trim()),
        category: p.category ?? "uncategorized",
        metadata: { ...(p.metadata ?? {}), dashboard_metrics: p.dashboard_metrics ?? [], source: "audio" },
      })
      .select("id, content, category, metadata, created_at")
      .single();
    if (error || !data) return json({ error: "Failed to create entry" }, 500);
    saved.push(data as (typeof saved)[number]);

    // The recording is attached once, to the first entry of the note.
    if (index === 0) {
      const mediaId = crypto.randomUUID();
      const path = storagePath(userId, data.id as string, mediaId, mime);
      const { error: upErr } = await serviceClient().storage.from("entry-media").upload(path, buffer, { contentType: mime, upsert: false });
      if (upErr) return json({ error: "Failed to store the recording" }, 500);
      await supabase.from("entry_media").insert({
        id: mediaId,
        entry_id: data.id,
        user_id: userId,
        kind: "audio",
        storage_path: path,
        mime,
        bytes: file.size,
        duration_s: durationS || null,
      });
    }
  }

  return json({ intent: "save_entry", entries: saved }, 201);
}
