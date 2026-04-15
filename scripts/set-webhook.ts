/**
 * Registers the Telegram webhook URL with the Bot API.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=<token> WEBHOOK_URL=https://<your-domain> npx tsx scripts/set-webhook.ts
 *
 * Or with a .env.local file loaded:
 *   npx tsx --env-file=.env.local scripts/set-webhook.ts
 *   (requires WEBHOOK_URL to also be set in .env.local or as an env var)
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = process.env.WEBHOOK_URL;

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN environment variable is not set.");
  process.exit(1);
}

if (!baseUrl) {
  console.error(
    "Error: WEBHOOK_URL environment variable is not set.\n" +
      "Set it to your deployed Vercel URL, e.g. https://your-app.vercel.app"
  );
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

async function setWebhook() {
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook`;

  console.log(`Registering webhook: ${webhookUrl}`);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };

  if (data.ok) {
    console.log("✓ Webhook registered successfully.");
  } else {
    console.error(`✗ Failed to register webhook: ${data.description}`);
    process.exit(1);
  }
}

setWebhook().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
