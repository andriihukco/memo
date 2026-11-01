export const runtime = "nodejs";

import { createTelegramSession } from "@/lib/auth-session";
import { env } from "@/lib/env";
import { verifyLoginWidget, type WidgetPayload } from "@/lib/telegram-login";

export async function POST(req: Request): Promise<Response> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return Response.json({ error: "Telegram sign-in is not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const payload: WidgetPayload = {} as WidgetPayload;
  for (const [k, v] of Object.entries(body)) {
    if (v === null || v === undefined) continue;
    payload[k] = String(v);
  }

  if (!verifyLoginWidget(payload, botToken)) {
    return Response.json({ error: "Telegram sign-in could not be verified" }, { status: 401 });
  }

  const result = await createTelegramSession({
    telegramId: payload.id,
    username: payload.username,
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({
    access_token: result.body.access_token,
    refresh_token: result.body.refresh_token,
  });
}
