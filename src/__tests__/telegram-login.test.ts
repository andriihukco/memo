import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { verifyLoginWidget, type WidgetPayload } from '@/lib/telegram-login';

const BOT = '123:test-bot-token';
const NOW_S = 1_800_000_000;

function sign(fields: Record<string, string>): WidgetPayload {
  const dataCheck = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHash('sha256').update(BOT).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return { ...fields, hash } as WidgetPayload;
}

const base = { id: '42', first_name: 'Ada', username: 'ada', auth_date: String(NOW_S - 60) };

describe('verifyLoginWidget', () => {
  it('accepts a payload signed with the bot token', () => {
    expect(verifyLoginWidget(sign(base), BOT, NOW_S)).toBe(true);
  });

  it('rejects a changed field', () => {
    const p = sign(base);
    expect(verifyLoginWidget({ ...p, id: '43' }, BOT, NOW_S)).toBe(false);
  });

  it('rejects a payload signed with another token', () => {
    const p = sign(base);
    expect(verifyLoginWidget(p, '999:other', NOW_S)).toBe(false);
  });

  it('rejects a payload older than a day', () => {
    const old = sign({ ...base, auth_date: String(NOW_S - 2 * 24 * 60 * 60) });
    expect(verifyLoginWidget(old, BOT, NOW_S)).toBe(false);
  });

  it('rejects a missing hash or non-numeric id', () => {
    expect(verifyLoginWidget({ ...base, hash: '' } as WidgetPayload, BOT, NOW_S)).toBe(false);
    expect(verifyLoginWidget(sign({ ...base, id: 'abc' }), BOT, NOW_S)).toBe(false);
  });
});
