export const runtime = "nodejs";

import { validateMedia, storagePath, SIGNED_URL_SECONDS, type MediaKind } from "@/lib/media";
import { bearerOf, profileIdOf, serviceClient, userClient } from "@/lib/entry-api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Music is a link, not a file: only these services are accepted, so the field cannot point anywhere else. */
const MUSIC_HOSTS = ["open.spotify.com", "music.apple.com", "music.youtube.com", "youtube.com", "soundcloud.com"];

function musicLink(raw: string): { url: string; provider: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (!MUSIC_HOSTS.includes(host)) return null;
  return { url: u.toString(), provider: host.split(".")[0] };
}

/** Attach a photo, a video or a music link to one of the signed-in user's entries. */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const jwt = bearerOf(req);
  if (!jwt) return json({ error: "Unauthorized" }, 401);
  const supabase = userClient(jwt);
  const userId = await profileIdOf(supabase);
  if (!userId) return json({ error: "Profile not found" }, 404);

  // The entry must be the user's own. Row-level security returns nothing for anyone else.
  const { data: entry } = await supabase.from("entries").select("id").eq("id", params.id).maybeSingle();
  if (!entry) return json({ error: "Not found" }, 404);

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { kind?: string; url?: string } | null;
    if (body?.kind !== "music" || typeof body.url !== "string") return json({ error: "music needs a url" }, 400);
    const link = musicLink(body.url);
    if (!link) return json({ error: "unsupported_music_link" }, 400);
    const { data, error } = await supabase
      .from("entry_media")
      .insert({ entry_id: params.id, user_id: userId, kind: "music", bytes: 0, meta: link })
      .select("id, kind, meta, created_at")
      .single();
    if (error) return json({ error: "Failed to attach" }, 500);
    return json({ media: data }, 201);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data" }, 400);
  }
  const kind = form.get("kind");
  if (kind !== "photo" && kind !== "video") return json({ error: "kind must be photo or video" }, 400);
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "file is required" }, 400);
  const durationS = form.get("duration_s") ? Number(form.get("duration_s")) : undefined;
  const mime = file.type;
  const refused = validateMedia(kind as MediaKind, mime, file.size, durationS);
  if (refused) return json({ error: refused }, refused === "unsupported_type" ? 415 : 413);

  // Row first, so the id names the file. If the upload fails, the row goes too.
  const mediaId = crypto.randomUUID();
  const path = storagePath(userId, params.id, mediaId, mime);
  const { error: rowErr } = await supabase.from("entry_media").insert({
    id: mediaId, entry_id: params.id, user_id: userId, kind, storage_path: path, mime, bytes: file.size, duration_s: durationS ?? null,
  });
  if (rowErr) return json({ error: "Failed to attach" }, 500);

  const { error: upErr } = await serviceClient().storage.from("entry-media").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (upErr) {
    await supabase.from("entry_media").delete().eq("id", mediaId);
    return json({ error: "Failed to store the file" }, 500);
  }
  return json({ media: { id: mediaId, kind, mime, bytes: file.size, duration_s: durationS ?? null } }, 201);
}

/** The entry's attachments. Files come back as signed links that expire after an hour. */
export async function GET(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const jwt = bearerOf(req);
  if (!jwt) return json({ error: "Unauthorized" }, 401);
  const supabase = userClient(jwt);
  const { data: rows, error } = await supabase
    .from("entry_media")
    .select("id, kind, storage_path, mime, bytes, duration_s, meta, created_at")
    .eq("entry_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return json({ error: "Failed to load" }, 500);

  const storage = serviceClient().storage.from("entry-media");
  const media = await Promise.all(
    (rows ?? []).map(async (row) => {
      if (!row.storage_path) return row;
      const { data } = await storage.createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
      return { ...row, url: data?.signedUrl ?? null };
    }),
  );
  return json({ media });
}
