/**
 * Unit tests for classify() in src/lib/classifier.ts.
 *
 * Covers:
 *  - Diary entry (save_entry intent)
 *  - Question about past data (question intent)
 *  - Action command (action intent)
 *  - Smalltalk / greeting (smalltalk intent)
 *  - Malformed Gemini response → fallback / ClassificationError
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock @google/generative-ai ────────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

// ── Mock env ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    GEMINI_API_KEY: 'test_gemini_key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_key',
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wrap a JSON object as a Gemini response text */
function geminiResponse(json: unknown): { response: { text: () => string } } {
  return { response: { text: () => JSON.stringify(json) } };
}

/** Wrap raw text as a Gemini response */
function geminiRawResponse(text: string): { response: { text: () => string } } {
  return { response: { text: () => text } };
}

// ── Import after mocks ────────────────────────────────────────────────────────

import { classify, ClassificationError } from '@/lib/classifier';

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('classify()', () => {
  it('classifies a diary entry (save_entry intent)', async () => {
    // Pass 1: classification
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'save_entry',
        entries: [
          {
            category: 'calories',
            category_label: 'Калорії',
            is_new_category: false,
            content: 'Поїв 200г курки та рис',
            metadata: { food_item: 'chicken + rice', estimated_calories: 400 },
          },
        ],
        action_type: 'none',
        action_params: {},
      })
    );
    // Pass 2: metrics extraction
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        dashboard_metrics: [
          { key: 'kcal_intake', label: 'Калорії', value: 400, unit: 'ккал', icon: 'utensils', aggregate: 'sum' },
        ],
        goal_metrics: [],
      })
    );

    const result = await classify('Поїв 200г курки та рис');

    expect(result.intent).toBe('save_entry');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].category).toBe('calories');
    expect(result.entries[0].content).toBe('Поїв 200г курки та рис');
  });

  it('classifies a question about past diary data (question intent)', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'question',
        entries: [],
        action_type: 'none',
        action_params: {},
      })
    );
    // No pass 2 for question intent

    const result = await classify('Скільки калорій я з\'їв сьогодні?');

    expect(result.intent).toBe('question');
    expect(result.entries).toHaveLength(0);
  });

  it('classifies an action command (action intent)', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'action',
        entries: [],
        action_type: 'delete_entries',
        action_params: { category: 'calories', period: 'today', description: 'delete today calories' },
      })
    );

    const result = await classify('Видали всі записи про калорії за сьогодні');

    expect(result.intent).toBe('action');
    expect(result.action_type).toBe('delete_entries');
    expect(result.entries).toHaveLength(0);
  });

  it('classifies smalltalk / greeting (smalltalk intent)', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'smalltalk',
        entries: [],
        action_type: 'none',
        action_params: {},
      })
    );

    const result = await classify('Привіт! Як справи?');

    expect(result.intent).toBe('smalltalk');
    expect(result.entries).toHaveLength(0);
  });

  it('throws ClassificationError when Gemini returns malformed JSON (after retries)', async () => {
    // Both retry attempts return malformed JSON
    mockGenerateContent.mockResolvedValue(
      geminiRawResponse('this is not json at all !!!')
    );

    await expect(classify('test message')).rejects.toThrow(ClassificationError);
  });

  it('falls back gracefully when Gemini returns JSON wrapped in markdown code block', async () => {
    // Pass 1: JSON wrapped in ```json ... ```
    mockGenerateContent.mockResolvedValueOnce(
      geminiRawResponse(
        '```json\n' +
        JSON.stringify({
          intent: 'smalltalk',
          entries: [],
          action_type: 'none',
          action_params: {},
        }) +
        '\n```'
      )
    );

    const result = await classify('ok');

    expect(result.intent).toBe('smalltalk');
  });

  it('handles backward-compat flat schema (no entries array)', async () => {
    // Old-style response with flat category/content fields
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'save_entry',
        entries: [],
        category: 'thoughts',
        category_label: 'Думки',
        is_new_category: false,
        content: 'Сьогодні гарний день',
        metadata: {},
        action_type: 'none',
        action_params: {},
      })
    );
    // Pass 2: metrics (thoughts category is non-metric, no goal keywords → skipped)
    // No second call expected for thoughts category

    const result = await classify('Сьогодні гарний день');

    expect(result.intent).toBe('save_entry');
    expect(result.category).toBe('thoughts');
    expect(result.content).toBe('Сьогодні гарний день');
  });

  it('classifies converse intent and runs metrics pass', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        intent: 'converse',
        entries: [
          {
            category: 'feelings',
            category_label: 'Почуття',
            is_new_category: false,
            content: 'Відчуваю тривогу',
            metadata: {},
          },
        ],
        action_type: 'none',
        action_params: {},
      })
    );
    // Pass 2 is skipped for feelings (non-metric, no goal keywords)

    const result = await classify('Відчуваю тривогу і не знаю що робити');

    expect(result.intent).toBe('converse');
    expect(result.entries[0].category).toBe('feelings');
  });
});
