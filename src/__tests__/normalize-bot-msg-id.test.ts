/**
 * Unit tests for REQ-19: Normalize bot_msg_id to string type.
 *
 * Covers:
 *  - 19.5 Thread resolution uses string comparison for bot_msg_id
 *         (metadata->>bot_msg_id equals String(replyToMessageId))
 *  - New writes store bot_msg_id as String(message_id), not raw number
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock heavy dependencies ───────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    GEMINI_API_KEY: 'test_key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
    TELEGRAM_BOT_TOKEN: 'test_bot_token',
  },
}));

vi.mock('@/lib/classifier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/classifier')>();
  return {
    ...actual,
    classify: vi.fn(),
    classifyAudio: vi.fn(),
  };
});

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

vi.mock('@/lib/analytics', () => ({
  capture: vi.fn().mockResolvedValue(undefined),
}));

// ── Supabase mock with call tracking ─────────────────────────────────────────

// We need to capture the eq() calls to verify string comparison is used.
// The resolveThread function calls:
//   supabase.from('entries').select(...).eq('user_id', userId).eq('metadata->>bot_msg_id', String(id)).maybeSingle()
// We track the arguments passed to eq() to verify string type.

const eqCalls: Array<[string, unknown]> = [];

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockNeq = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

// Chain builder — each method returns `this` (the chain object)
function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return chain;
  });
  chain.neq = mockNeq.mockReturnValue(chain);
  chain.in = mockIn.mockReturnValue(chain);
  chain.gte = mockGte.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.limit = mockLimit.mockReturnValue(chain);
  chain.maybeSingle = mockMaybeSingle;
  chain.single = mockSingle;
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { classify } from '@/lib/classifier';
import { handleTextMessage } from '@/lib/bot/handlers/text';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function makeMockCtx(replyToMessageId?: number) {
  const reply = vi.fn().mockResolvedValue({ message_id: 99 });
  const replyWithChatAction = vi.fn().mockResolvedValue(undefined);

  return {
    message: {
      text: 'test message',
      reply_to_message: replyToMessageId
        ? { message_id: replyToMessageId }
        : undefined,
    },
    reply,
    replyWithChatAction,
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
  };
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;

  // Default: resolveThread finds no matching entry (no thread)
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  // Default: profile salt fetch returns null
  mockSingle.mockResolvedValue({ data: { encryption_salt: null }, error: null });
  // Default: insert returns a new entry id
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'entry-abc' }, error: null }),
    }),
  });
  // Default: update returns success
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    in: vi.fn().mockResolvedValue({ data: {}, error: null }),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('REQ-19: bot_msg_id normalization', () => {
  /**
   * 19.5 Thread resolution uses string comparison for bot_msg_id.
   *
   * When a user replies to a bot message with a numeric message_id,
   * the handler must query metadata->>bot_msg_id using String(messageId),
   * not the raw number. This ensures compatibility with the normalized
   * string values stored after migration 20240001000022.
   */
  describe('19.5 thread resolution uses string bot_msg_id comparison', () => {
    it('queries metadata->>bot_msg_id with a string value, not a number', async () => {
      vi.mocked(classify).mockResolvedValue(makeSuccessResult());

      // Simulate user replying to bot message with id 12345 (a number)
      const ctx = makeMockCtx(12345);

      await handleTextMessage(ctx as never);

      // Find the eq() call for metadata->>bot_msg_id
      const botMsgIdCall = eqCalls.find(([col]) => col === 'metadata->>bot_msg_id');

      expect(botMsgIdCall).toBeDefined();
      // The value passed must be a string, not a number
      expect(typeof botMsgIdCall![1]).toBe('string');
      expect(botMsgIdCall![1]).toBe('12345');
    });

    it('passes the correct string representation of the message_id', async () => {
      vi.mocked(classify).mockResolvedValue(makeSuccessResult());

      // Use a large realistic Telegram message_id
      const ctx = makeMockCtx(987654321);

      await handleTextMessage(ctx as never);

      const botMsgIdCall = eqCalls.find(([col]) => col === 'metadata->>bot_msg_id');

      expect(botMsgIdCall).toBeDefined();
      expect(botMsgIdCall![1]).toBe('987654321');
    });

    it('does not query metadata->>bot_msg_id when there is no reply_to_message', async () => {
      vi.mocked(classify).mockResolvedValue(makeSuccessResult());

      // No reply_to_message — not a thread reply
      const ctx = makeMockCtx(undefined);

      await handleTextMessage(ctx as never);

      const botMsgIdCall = eqCalls.find(([col]) => col === 'metadata->>bot_msg_id');

      // resolveThread returns early when replyToMessageId is undefined
      expect(botMsgIdCall).toBeUndefined();
    });
  });

  /**
   * New writes store bot_msg_id as String(message_id).
   *
   * After the handler sends a reply, it updates the entry metadata with
   * bot_msg_id. Verify the value stored is a string, not a number.
   */
  describe('new writes store bot_msg_id as string', () => {
    it('stores bot_msg_id as a string in the metadata update', async () => {
      vi.mocked(classify).mockResolvedValue(makeSuccessResult());

      // Capture the metadata passed to the update call
      let capturedMetadata: Record<string, unknown> | undefined;

      // Override update to capture the argument
      const mockUpdateWithCapture = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        if (data.metadata) {
          capturedMetadata = data.metadata as Record<string, unknown>;
        }
        return {
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
          in: vi.fn().mockResolvedValue({ data: {}, error: null }),
        };
      });

      // Re-mock supabase to capture the update call
      const { createClient } = await import('@supabase/supabase-js');
      vi.mocked(createClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'entry-xyz' }, error: null }),
                }),
              }),
              update: mockUpdateWithCapture,
            };
          }
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { encryption_salt: null }, error: null }),
                }),
              }),
            };
          }
          if (table === 'categories') {
            return {
              upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      } as never);

      const ctx = makeMockCtx(undefined);
      // reply returns a message with a numeric message_id (as Telegram does)
      ctx.reply = vi.fn().mockResolvedValue({ message_id: 42 });

      await handleTextMessage(ctx as never);

      // The metadata update should have been called
      expect(mockUpdateWithCapture).toHaveBeenCalled();

      // bot_msg_id in metadata must be a string
      if (capturedMetadata && 'bot_msg_id' in capturedMetadata) {
        expect(typeof capturedMetadata.bot_msg_id).toBe('string');
        expect(capturedMetadata.bot_msg_id).toBe('42');
      }
    });
  });
});
