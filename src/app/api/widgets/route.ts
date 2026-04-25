export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getEffectiveTier, TIER_INFO } from '@/lib/stars/paywall';

function getUserJwt(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function makeSupabase(jwt: string) {
  return createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

// ── POST /api/widgets — AI analyses user prompt and creates a custom widget definition ──

export async function POST(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { prompt, answers, direct } = await req.json().catch(() => ({}));
  if (!prompt && !direct) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });

  // Resolve user id for tier check
  const supabase = makeSupabase(jwt);
  const { data: profile } = await supabase.from('profiles').select('id, settings').single();
  if (!profile) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404 });

  const userId = profile.id as string;
  const tier = await getEffectiveTier(userId);
  const limits = TIER_INFO[tier].limits;

  // Check custom_widgets feature gate — free tier gets 3 widgets
  const settings = (profile.settings as Record<string, unknown>) ?? {};
  const customWidgets = (settings.custom_widgets as unknown[]) ?? [];
  const widgetCount = customWidgets.length;

  if (limits.widgets !== Infinity && widgetCount >= limits.widgets) {
    return new Response(JSON.stringify({
      error: 'limit_exceeded',
      feature: tier === 'free' ? 'custom_widgets' : 'widgets',
      limit: limits.widgets,
      current: widgetCount,
      required_tier: tier === 'free' ? 'stars_basic' : 'stars_pro',
    }), { status: 402, headers: { 'Content-Type': 'application/json' } });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Direct widget creation — client provides full definition, skip AI
  if (direct && typeof direct === 'object' && direct.id) {
    const widget = { ...direct, created_at: new Date().toISOString() };
    const filtered = (customWidgets as Array<{ id: string }>).filter((w: { id: string }) => w.id !== widget.id);
    filtered.push(widget as { id: string });
    await supabase.from('profiles').update({
      settings: { ...settings, custom_widgets: filtered },
    }).eq('id', userId);
    return new Response(JSON.stringify({ widget }), { headers: { 'Content-Type': 'application/json' } });
  }

  // If no answers yet — generate clarifying questions
  if (!answers) {
    const questionsPrompt = `You are helping a user create a personal tracking widget for their diary app.
The user wants to track: "${prompt}"

Generate 2-3 short clarifying questions to better understand what they want to track.
Return JSON: {"questions": ["question1", "question2", "question3"]}
Questions should be in the same language as the user's prompt.
Keep questions short and practical (e.g. "How often do you want to track this?", "What unit should we use?").
Return ONLY valid JSON.`;

    const result = await model.generateContent(questionsPrompt);
    const raw = result.response.text().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return new Response(JSON.stringify({ questions: parsed.questions ?? [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // With answers — create the widget definition
  const createPrompt = `You are creating a personal tracking widget for a diary app.

User wants to track: "${prompt}"
User's answers to clarifying questions:
${Object.entries(answers as Record<string, string>).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n')}

Create a widget definition. Return JSON:
{
  "id": "<snake_case_unique_id>",
  "title": "<short display title in user's language>",
  "description": "<one sentence description>",
  "metric_key": "<snake_case metric key to track in dashboard_metrics>",
  "unit": "<unit string>",
  "icon": "<lucide icon name from: flame, wallet, dumbbell, lightbulb, brain, droplets, moon, book-open, scale, smile, zap, wind, map-pin, utensils, heart, activity, trending-up, clock, star, target, coffee, leaf, pill, award>",
  "color": "<one of: slate, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose>",
  "aggregate": "<sum|avg|last>",
  "category": "<most relevant diary category: thoughts, ideas, feelings, expenses, calories, workout, goals, sleep, health, dreams, books, work, relationships, travel, gratitude, music, social>"
}

Return ONLY valid JSON.`;

  const result = await model.generateContent(createPrompt);
  const raw = result.response.text().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const widget = JSON.parse(raw);

  // Save widget definition to user's profile settings
  // Avoid duplicates
  const filtered = (customWidgets as Array<{ id: string }>).filter(w => w.id !== widget.id);
  filtered.push({ ...widget, created_at: new Date().toISOString() });

  await supabase.from('profiles').update({
    settings: { ...settings, custom_widgets: filtered },
  }).eq('id', userId);

  return new Response(JSON.stringify({ widget }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── GET /api/widgets — fetch user's custom widgets ──

export async function GET(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const supabase = makeSupabase(jwt);
  const { data: profile } = await supabase.from('profiles').select('settings').single();
  const settings = (profile?.settings as Record<string, unknown>) ?? {};
  const customWidgets = (settings.custom_widgets as unknown[]) ?? [];

  return new Response(JSON.stringify({ widgets: customWidgets }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── DELETE /api/widgets — remove a custom widget ──

export async function DELETE(req: Request): Promise<Response> {
  const jwt = getUserJwt(req);
  if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const supabase = makeSupabase(jwt);
  const { data: profile } = await supabase.from('profiles').select('settings').single();
  const settings = (profile?.settings as Record<string, unknown>) ?? {};
  const customWidgets = ((settings.custom_widgets as Array<{ id: string }>) ?? []).filter(w => w.id !== id);

  await supabase.from('profiles').update({
    settings: { ...settings, custom_widgets: customWidgets },
  }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
