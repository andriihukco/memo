// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { ListGroup, ListRow } from '@/components/patterns/list-group';
import { EmptyState } from '@/components/patterns/empty-state';
import { ErrorState } from '@/components/patterns/error-state';
import { CategoryBadge } from '@/components/patterns/category-badge';
import { MetricPill } from '@/components/patterns/metric-pill';

afterEach(cleanup);

describe('patterns', () => {
  it('ListRow with href renders a link', () => {
    render(<ListGroup title="T"><ListRow label="Go" href="/x" /></ListGroup>);
    expect(screen.getByRole('link', { name: 'Go' }).tagName).toBe('A');
    expect(screen.getByRole('heading', { name: 'T' })).toBeTruthy();
  });
  it('ListRow with onClick renders a button named by label', () => {
    const fn = vi.fn();
    render(<ListRow label="Do it" onClick={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(fn).toHaveBeenCalled();
  });
  it('EmptyState renders exactly one button', () => {
    render(<EmptyState icon={Inbox} title="t" description="d" action={{ label: 'Add', onClick: () => {} }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('ErrorState calls onRetry', () => {
    const fn = vi.fn();
    render(<ErrorState title="t" description="d" onRetry={fn} />);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalled();
  });
  it('CategoryBadge and MetricPill render', () => {
    render(<><CategoryBadge name="work" label="Work" /><MetricPill label="Streak" value="5" /></>);
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });
});
