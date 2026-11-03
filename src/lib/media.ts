/**
 * Rules for files attached to a timeline entry. The same limits are checked on the client before
 * upload, so the server check is the last line, not the first.
 */

export type MediaKind = "photo" | "video" | "audio";

const MB = 1024 * 1024;

export const MEDIA_RULES: Record<MediaKind, { mimes: readonly string[]; maxBytes: number; maxSeconds: number }> = {
  photo: { mimes: ["image/jpeg", "image/png", "image/webp", "image/heic"], maxBytes: 12 * MB, maxSeconds: 0 },
  video: { mimes: ["video/mp4", "video/quicktime", "video/webm"], maxBytes: 50 * MB, maxSeconds: 60 },
  audio: { mimes: ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/ogg", "audio/mpeg", "audio/wav"], maxBytes: 2 * MB, maxSeconds: 120 },
};

/** Why a file is refused, or null when it is accepted. */
export function validateMedia(kind: MediaKind, mime: string, bytes: number, durationS?: number): string | null {
  const rule = MEDIA_RULES[kind];
  if (!rule.mimes.includes(mime)) return "unsupported_type";
  if (bytes <= 0) return "empty";
  if (bytes > rule.maxBytes) return "too_large";
  if (rule.maxSeconds > 0 && durationS !== undefined && durationS > rule.maxSeconds) return "too_long";
  return null;
}

/** File extension for a stored object, from its mime type. */
export function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "audio/webm": "webm", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav",
  };
  return map[mime] ?? "bin";
}

/** Object path inside the bucket. Each user has their own folder, and the id keeps names unique. */
export function storagePath(userId: string, entryId: string, mediaId: string, mime: string): string {
  return `${userId}/${entryId}/${mediaId}.${extensionFor(mime)}`;
}

/** Signed links last an hour: long enough to watch a video, short enough to stop sharing a link. */
export const SIGNED_URL_SECONDS = 3600;
