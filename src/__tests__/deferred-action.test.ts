import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { schedule, undo, flushAll, pendingKeys } from '@/lib/deferred-action';

describe('deferred-action', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    await flushAll();
    vi.useRealTimers();
  });

  it('commits after 5000ms and not before', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    schedule('a', commit, vi.fn());
    vi.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(pendingKeys()).toEqual([]);
  });

  it('undo rolls back and never commits', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn();
    schedule('a', commit, rollback);
    expect(undo('a')).toBe(true);
    expect(undo('a')).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it('flushAll commits pending at once', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    schedule('a', commit, vi.fn());
    await flushAll();
    expect(commit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('same key twice keeps one commit', () => {
    const c1 = vi.fn().mockResolvedValue(undefined);
    const c2 = vi.fn().mockResolvedValue(undefined);
    schedule('a', c1, vi.fn());
    schedule('a', c2, vi.fn());
    expect(pendingKeys()).toEqual(['a']);
    vi.advanceTimersByTime(5000);
    expect(c1).not.toHaveBeenCalled();
    expect(c2).toHaveBeenCalledTimes(1);
  });
});
