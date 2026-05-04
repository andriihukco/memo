/**
 * Unit tests for error paths in the bot pipeline fix.
 * Spec: .kiro/specs/bot-pipeline-fix/
 *
 * Covers:
 *  - 6.1 handleVoiceMessage replies with localised error when classifyAudio() throws ClassificationError
 *  - 6.2 handleTextMessage does not throw and replies with localised error when classify() throws TypeError
 *  - 6.3 handleTextMessage returns successful classification when classify() fails on first call but succeeds on second
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock classifier module ────────────────────────────────────────────────────

vi.mock('@/lib/classifier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/classifier')>();
  return {
    ...actual,
    classify: vi.fn(),
    classifyAudio: vi.fn(),
  };
});

// ── Mock heavy dependencies that handlers import ──────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    GEMINI_API_KEY: 'test_key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    TELEGRAM_BOT_TOKEN: 'test_bot_token',
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock('@/lib/embedding', () => ({
  embedEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bot/qa', () => ({
  answerQuestion: vi.fn().mockResolvedValue('answer'),
}));

vi.mock('@/lib/bot/converse', () => ({
  generateConverseReply: vi.fn().mockResolvedValue('reply'),
  loadUserContext: vi.fn().mockResolvedValue({ tone: '', memory: {} }),
}));

vi.mock('@/lib/bot/smart-reply', () => ({
  generateSmartReply: vi.fn().mockResolvedValue({ text: 'smart reply', usedFallback: false }),
}));

vi.mock('@/lib/bot/handlers/action', () => ({
  handleAction: vi.fn().mockResolvedValue(undefined),
  checkPendingDelete: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/bot/memory', () => ({
  extractFacts: vi.fn().mockResolvedValue({}),
  saveMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/crypto', () => ({
  deriveUserKey: vi.fn().mockResolvedValue(null),
  encryptField: vi.fn().mockImplementation((v: string) => Promise.resolve(v)),
}));

vi.mock('@/lib/utils', () => ({
  sanitizeMarkdown: vi.fn().mockImplementation((s: string) => s),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { classify, classifyAudio, ClassificationError } from '@/lib/classifier';
import { handleVoiceMessage } from '@/lib/bot/handlers/voice';
import { handleTextMessage } from '@/lib/bot/handlers/text';
import { t } from '@/i18n/t';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal mock bot context */
function makeMockCtx(overrides: Record<string, unknown> = {}) {
  const reply = vi.fn().mockResolvedValue({ message_id: 42 });
  const replyWithChatAction = vi.fn().mockResolvedValue(undefined);
  const getFile = vi.fn().mockResolvedValue({ file_path: 'voice/test.ogg' });

  return {
    message: {
      voice: { file_id: 'test_file_id', duration: 5 },
      text: 'test message',
      reply_to_message: undefined,
    },
    reply,
    replyWithChatAction,
    getFile,
    locale: 'en' as const,
    profile: {
      id: 'user-123',
      telegram_id: 123456789,
      settings: { language: 'en' },
    },
    chat: { id: 12345 },
    api: {
      editMessageText: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

/** Minimal successful ClassificationResult */
function makeSuccessResult() {
  return {
    intent: 'save_entry' as const,
    entries: [
      {
        category: 'thoughts',
        category_label: 'Thoughts',
        is_new_category: false,
        content: 'test content',
        metadata: {},
        dashboard_metrics: [],
        goal_metrics: [],
      },
    ],
    action_type: 'none' as const,
    action_params: {},
    category: 'thoughts',
    category_label: 'Thoughts',
    is_new_category: false,
    content: 'test content',
    metadata: {},
    dashboard_metrics: [],
    goal_metrics: [],
  };
}

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleVoiceMessage — error paths', () => {
  it(
    // 6.1: classifyAudio() throws ClassificationError → handler replies with English error string
    '6.1: replies with localised voice_failed error when classifyAudio() throws ClassificationError',
    async () => {
      // Both the initial call and the retry inside voice.ts throw ClassificationError
      vi.mocked(classifyAudio).mockRejectedValue(
        new ClassificationError('Gemini quota exceeded')
      );

      // Mock fetch for audio download
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response);

      const ctx = makeMockCtx({ locale: 'en' });
      // Voice message context
      ctx.message = {
        ...ctx.message,
        voice: { file_id: 'test_file_id', duration: 5 },
      };

      await handleVoiceMessage(ctx as never);

      const expectedError = t('bot.error.voice_failed', 'en');
      expect(ctx.reply).toHaveBeenCalledWith(expectedError);
    }
  );
});

describe('handleTextMessage — error paths', () => {
  it(
    // 6.2: classify() throws TypeError → handler does not throw and replies with English error string
    '6.2: does not throw and replies with localised classify_failed error when classify() throws TypeError',
    async () => {
      vi.mocked(classify).mockRejectedValue(new TypeError('Network request failed'));

      const ctx = makeMockCtx({ locale: 'en' });
      ctx.message = { ...ctx.message, text: 'I ate 200g chicken' };

      // Should not throw
      await expect(handleTextMessage(ctx as never)).resolves.toBeUndefined();

      const expectedError = t('bot.error.classify_failed', 'en');
      expect(ctx.reply).toHaveBeenCalledWith(expectedError);
    }
  );

  it(
    // 6.3: classify() throws ClassificationError on first call, succeeds on second → returns successful result
    '6.3: returns successful classification when classify() fails on first call but succeeds on second',
    async () => {
      const successResult = makeSuccessResult();

      vi.mocked(classify)
        .mockRejectedValueOnce(new ClassificationError('Transient Gemini failure'))
        .mockResolvedValueOnce(successResult);

      const ctx = makeMockCtx({ locale: 'en' });
      ctx.message = { ...ctx.message, text: 'I ate 200g chicken' };

      await handleTextMessage(ctx as never);

      // classify() should have been called twice (initial + retry)
      expect(classify).toHaveBeenCalledTimes(2);

      // Handler should NOT have replied with an error
      const expectedError = t('bot.error.classify_failed', 'en');
      expect(ctx.reply).not.toHaveBeenCalledWith(expectedError);
    }
  );
});
