// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

vi.mock('@/lib/sound/use-sound', () => ({ useSound: () => ({ play: vi.fn() }) }));
import { DrawerOpenTracker } from '@/components/shell/app-shell';

const webApp = { disableVerticalSwipes: vi.fn(), enableVerticalSwipes: vi.fn() };

beforeAll(() => {
  (window as unknown as { Telegram: unknown }).Telegram = { WebApp: webApp };
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as never;
});

const Ui = ({ open }: { open: boolean }) => (
  <>
    <DrawerOpenTracker />
    <Drawer open={open}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerTitle>t</DrawerTitle>
      </DrawerContent>
    </Drawer>
  </>
);

describe('DrawerOpenTracker', () => {
  it('disables Telegram vertical swipes while a vaul drawer is open, re-enables on close', async () => {
    const { rerender } = render(<Ui open={false} />);
    expect(webApp.disableVerticalSwipes).not.toHaveBeenCalled();

    rerender(<Ui open />);
    await waitFor(() => expect(document.querySelector('[data-vaul-drawer][data-state="open"]')).not.toBeNull());
    await waitFor(() => expect(webApp.disableVerticalSwipes).toHaveBeenCalledTimes(1));

    rerender(<Ui open={false} />);
    await waitFor(() => expect(webApp.enableVerticalSwipes).toHaveBeenCalledTimes(1));
  });
});
