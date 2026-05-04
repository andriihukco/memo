import { processUser, processAllUsers, processReminders, processStreakNotifications, processWeeklySummaries } from "@/lib/processing/loop";
import { sendStreakReminders, sendExpiryReminders } from "@/lib/processing/notifications";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  // Verify Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  try {
    if (userId) {
      await processUser(userId);
      return Response.json({ ok: true, processed: [userId] });
    } else {
      await processAllUsers();
      await processReminders();
      await processStreakNotifications();
      await sendStreakReminders();
      await sendExpiryReminders();
      // Run weekly summaries on Mondays (day 1)
      if (new Date().getDay() === 1) {
        await processWeeklySummaries();
      }
      return Response.json({ ok: true, processed: "all" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/process] Error:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
