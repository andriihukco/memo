/**
 * Registers the Telegram webhook URL with the Bot API.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=<token> WEBHOOK_URL=https://<your-domain> npx tsx scripts/set-webhook.ts
 *
 * Or with a .env.local file loaded:
 *   npx tsx --env-file=.env.local scripts/set-webhook.ts
 *   (requires WEBHOOK_URL to also be set in .env.local or as an env var)
 *
 * The TELEGRAM_WEBHOOK_SECRET env var is optional but strongly recommended.
 * When set, Telegram will include X-Telegram-Bot-Api-Secret-Token on every
 * update, and the webhook handler will reject requests that omit it (HTTP 403).
 * Generate a secret with: openssl rand -hex 32
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = process.env.WEBHOOK_URL;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

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
  if (webhookSecret) {
    console.log("Using secret_token for webhook verification.");
  } else {
    console.warn(
      "Warning: TELEGRAM_WEBHOOK_SECRET is not set. " +
        "The webhook will accept requests from any source. " +
        "Set TELEGRAM_WEBHOOK_SECRET and re-run this script to enable secret verification."
    );
  }

  const body: Record<string, string> = { url: webhookUrl };
  if (webhookSecret) {
    body.secret_token = webhookSecret;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok: boolean; description?: string };

  if (data.ok) {
    console.log("✓ Webhook registered successfully.");
    if (webhookSecret) {
      console.log("✓ secret_token registered — Telegram will send X-Telegram-Bot-Api-Secret-Token on every update.");
    }
  } else {
    console.error(`✗ Failed to register webhook: ${data.description}`);
    process.exit(1);
  }
}

setWebhook().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
