// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { useUndoableDelete } from '@/lib/hooks/use-undoable-delete';
import { flushAll } from '@/lib/deferred-action';

vi.mock('sonner', () => {
  const toast = Object.assign(vi.fn(() => 'id1'), { error: vi.fn(), dismiss: vi.fn() });
  return { toast };
});

const opts = () => ({ key: 'k', label: 'Gone', remove: vi.fn(), restore: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) });

describe('useUndoableDelete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows toast with Undo; Undo restores and never commits', async () => {
    const o = opts();
    renderHook(() => useUndoableDelete()).result.current(o);
    expect(o.remove).toHaveBeenCalled();
    const [label, cfg] = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(label).toBe('Gone');
    expect(cfg.action.label).toBeTruthy();
    cfg.action.onClick();
    await flushAll();
    expect(o.restore).toHaveBeenCalledTimes(1);
    expect(o.commit).not.toHaveBeenCalled();
  });

  it('commit failure restores and shows an error toast', async () => {
    const o = opts();
    o.commit.mockRejectedValue(new Error('x'));
    renderHook(() => useUndoableDelete()).result.current(o);
    await flushAll();
    expect(o.restore).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith('id1');
  });
});
