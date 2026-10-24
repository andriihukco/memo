# Cross-Platform UI — Web & Telegram Mini App

This document defines adaptation patterns between Web desktop/mobile layouts and Telegram Mini App viewports.

---

## Platform Strategy

### Web-First Foundation

Build all core features for the open web target first:

- **Authentication** — Web-based auth with Telegram as one provider
- **Routing** — Standard Next.js routing
- **Business Logic** — Platform-agnostic
- **Storage** — Supabase (works everywhere)
- **Media Handling** — Web APIs with fallbacks

### Telegram Mini App Integration

Wrap Telegram-specific behaviors in isolated adapters:

- **Telegram WebApp SDK** — Wrapped in `useTelegramAdapter` hook
- **Haptic Feedback** — Wrapped in `useHaptics` hook
- **Native Back Button** — Wrapped in `useBackButton` hook
- **Main Button Controls** — Wrapped in `useMainButton` hook
- **Safe Area Insets** — Applied via CSS variables

### Cross-Platform Parity

Ensure the app runs seamlessly in standard desktop/mobile browsers without crashing or requiring the Telegram WebApp runtime environment.

---

## Telegram Adapter Hook

### Implementation

```typescript
// src/lib/hooks/use-telegram-adapter.ts
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  isClosingConfirmationEnabled: boolean;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'success' | 'error' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  MainButton?: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    setParams: (params: { text?: string; color?: string; textColor?: string }) => void;
  };
  openInvoice: (url: string, callback: (status: string) => void) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string) => void;
  requestContact: () => void;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ text: string; url?: string }> }) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
  };
  colorScheme: Theme;
  viewportHeight: number;
  viewportStableHeight: number;
  headerHeight: number;
  safeAreaInset: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset: { top: number; bottom: number; left: number; right: number };
  isExpanded: boolean;
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    receiver?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    start_param?: string;
    chat?: {
      id: number;
      type: string;
      title: string;
      username?: string;
      photo_url?: string;
    };
  };
  version: string;
  platform: string;
}

export function useTelegramAdapter() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const telegramWebApp = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp;

    if (telegramWebApp) {
      setIsTelegram(true);
      setTg(telegramWebApp);
      telegramWebApp.ready();
      telegramWebApp.expand();
    }
  }, []);

  return {
    isTelegram,
    tg,
    ready: () => tg?.ready(),
    expand: () => tg?.expand(),
    close: () => tg?.close(),
    enableClosingConfirmation: () => tg?.enableClosingConfirmation(),
    openInvoice: (url: string, callback?: (status: string) => void) => {
      if (tg?.openInvoice) {
        tg.openInvoice(url, callback || (() => {}));
      } else {
        // Web fallback: open URL in new tab
        window.open(url, '_blank');
      }
    },
    openLink: (url: string) => {
      if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    },
    hapticImpact: (style: 'light' | 'medium' | 'heavy' = 'medium') => {
      if (tg?.HapticFeedback?.impactOccurred) {
        tg.HapticFeedback.impactOccurred(style);
      } else {
        // Web fallback: use navigator.vibrate if available
        if (navigator.vibrate) {
          const duration = style === 'light' ? 10 : style === 'medium' ? 20 : 30;
          navigator.vibrate(duration);
        }
      }
    },
    hapticNotification: (type: 'success' | 'error' | 'warning') => {
      if (tg?.HapticFeedback?.notificationOccurred) {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        // Web fallback: use navigator.vibrate if available
        if (navigator.vibrate) {
          const pattern = type === 'success' ? [50] : type === 'error' ? [50, 50, 50] : [30];
          navigator.vibrate(pattern);
        }
      }
    },
    hapticSelection: () => {
      if (tg?.HapticFeedback?.selectionChanged) {
        tg.HapticFeedback.selectionChanged();
      }
    },
    showBackButton: (onClick: () => void) => {
      if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(onClick);
      }
    },
    hideBackButton: () => {
      if (tg?.BackButton) {
        tg.BackButton.hide();
      }
    },
    theme: tg?.colorScheme || 'dark',
    safeAreaInset: tg?.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: tg?.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 },
  };
}
```

### Usage Example

```tsx
import { useTelegramAdapter } from '@/lib/hooks/use-telegram-adapter';

function MyComponent() {
  const { isTelegram, hapticImpact, openInvoice } = useTelegramAdapter();

  const handleClick = () => {
    hapticImpact('medium');
    // Your logic here
  };

  const handlePayment = () => {
    openInvoice('https://t.me/your-bot?startapp=invoice', (status) => {
      if (status === 'paid') {
        // Handle success
      }
    });
  };

  return (
    <div>
      <button onClick={handleClick}>Click me</button>
      <button onClick={handlePayment}>Pay</button>
    </div>
  );
}
```

---

## Safe Area Insets

### CSS Variables

Apply safe area insets as CSS variables:

```tsx
// src/app/miniapp/layout.tsx
import { useTelegramAdapter } from '@/lib/hooks/use-telegram-adapter';

function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const { safeAreaInset, contentSafeAreaInset } = useTelegramAdapter();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.style.setProperty('--safe-top', `${safeAreaInset.top}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${safeAreaInset.bottom}px`);
    document.documentElement.style.setProperty('--safe-left', `${safeAreaInset.left}px`);
    document.documentElement.style.setProperty('--safe-right', `${safeAreaInset.right}px`);
  }, [safeAreaInset]);

  return <>{children}</>;
}
```

### CSS Utility Classes

```css
/* src/app/globals.css */
.pt-safe-top {
  padding-top: max(0px, env(safe-area-inset-top));
}

.pb-safe-bottom {
  padding-bottom: max(0px, env(safe-area-inset-bottom));
}

.px-safe {
  padding-left: max(0px, env(safe-area-inset-left));
  padding-right: max(0px, env(safe-area-inset-right));
}
```

---

## Viewport Adaptation

### Telegram Mini App Viewport

```tsx
function useViewport() {
  const { tg, isTelegram } = useTelegramAdapter();

  useEffect(() => {
    if (!isTelegram || !tg) return;

    const handleViewportChanged = () => {
      // Handle viewport changes
    };

    tg.onEvent('viewportChanged', handleViewportChanged);

    return () => {
      tg.offEvent('viewportChanged', handleViewportChanged);
    };
  }, [isTelegram, tg]);

  return {
    height: tg?.viewportHeight || window.innerHeight,
    stableHeight: tg?.viewportStableHeight || window.innerHeight,
    isExpanded: tg?.isExpanded || false,
  };
}
```

### Web Viewport

```tsx
function useWebViewport() {
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return { height, stableHeight: height, isExpanded: true };
}
```

---

## Theme Adaptation

### Telegram Theme Detection

```tsx
function useTelegramTheme() {
  const { tg, isTelegram } = useTelegramAdapter();

  useEffect(() => {
    if (!isTelegram || !tg) return;

    const handleThemeChanged = () => {
      // Sync with Telegram theme
      const newTheme = tg.colorScheme;
      // Update your theme provider
    };

    tg.onEvent('themeChanged', handleThemeChanged);

    return () => {
      tg.offEvent('themeChanged', handleThemeChanged);
    };
  }, [isTelegram, tg]);

  return {
    theme: tg?.colorScheme || 'dark',
    themeParams: tg?.themeParams || {},
  };
}
```

### Web Theme

```tsx
import { useTheme } from '@/lib/theme-provider';

function WebThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
```

---

## Keyboard Adaptation

### Telegram Keyboard

```tsx
function useTelegramKeyboard() {
  const { tg, isTelegram } = useTelegramAdapter();

  useEffect(() => {
    if (!isTelegram || !tg) return;

    const handleKeyboardWillShow = () => {
      // Adjust layout for keyboard
    };

    const handleKeyboardWillHide = () => {
      // Restore layout
    };

    tg.onEvent('keyboardWillShow', handleKeyboardWillShow);
    tg.onEvent('keyboardWillHide', handleKeyboardWillHide);

    return () => {
      tg.offEvent('keyboardWillShow', handleKeyboardWillShow);
      tg.offEvent('keyboardWillHide', handleKeyboardWillHide);
    };
  }, [isTelegram, tg]);
}
```

### Web Keyboard

```tsx
function useWebKeyboard() {
  useEffect(() => {
    const handleResize = () => {
      // Detect keyboard by viewport height change
      const keyboardVisible = window.innerHeight < window.screen.height * 0.75;
      // Adjust layout
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
}
```

---

## Payment Adaptation

### Telegram Payments

```tsx
function useTelegramPayment() {
  const { openInvoice, isTelegram } = useTelegramAdapter();

  const initiatePayment = async (invoiceUrl: string) => {
    if (isTelegram) {
      return new Promise((resolve) => {
        openInvoice(invoiceUrl, (status) => {
          resolve(status);
        });
      });
    } else {
      // Web fallback: redirect to payment page
      window.location.href = invoiceUrl;
      return 'redirected';
    }
  };

  return { initiatePayment };
}
```

### Web Payments

```tsx
function useWebPayment() {
  const initiatePayment = async (invoiceUrl: string) => {
    // Open payment modal or redirect
    window.open(invoiceUrl, '_blank');
  };

  return { initiatePayment };
}
```

---

## Voice Recording Adaptation

### Telegram Voice (Bot)

```tsx
// Server-side: src/lib/bot/handlers/voice.ts
// Already implemented - handles voice messages from Telegram bot
```

### Web Voice (MediaRecorder)

```tsx
// src/components/features/voice/voice-recorder.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div>
      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? '⏹️ Stop' : '🎤 Record'}
      </button>
      {audioBlob && (
        <audio controls src={URL.createObjectURL(audioBlob)} />
      )}
    </div>
  );
}
```

---

## Testing Cross-Platform

### Telegram Testing

1. **Test in Telegram Mini App** — Use BotFather to create test bot
2. **Test in different themes** — Dark, light, system
3. **Test on different devices** — iOS, Android, desktop
4. **Test safe areas** — Notched devices, tablets

### Web Testing

1. **Test in desktop browsers** — Chrome, Firefox, Safari
2. **Test in mobile browsers** — Chrome Mobile, Safari Mobile
3. **Test in different screen sizes** — Responsive design
4. **Test keyboard navigation** — Tab, Enter, Escape

### Automated Testing

```tsx
// __tests__/cross-platform/telegram-adapter.test.tsx
import { renderHook } from '@testing-library/react';
import { useTelegramAdapter } from '@/lib/hooks/use-telegram-adapter';

describe('useTelegramAdapter', () => {
  it('works without Telegram WebApp', () => {
    const { result } = renderHook(() => useTelegramAdapter());
    expect(result.current.isTelegram).toBe(false);
    expect(result.current.hapticImpact).toBeDefined(); // Should not throw
  });

  it('handles missing haptic API gracefully', () => {
    const { result } = renderHook(() => useTelegramAdapter());
    expect(() => result.current.hapticImpact('medium')).not.toThrow();
  });
});
```

---

## Best Practices

### DO

- ✅ Always use adapter hooks for Telegram-specific features
- ✅ Provide web fallbacks for all Telegram APIs
- ✅ Test in both Telegram and web environments
- ✅ Use CSS variables for safe area insets
- ✅ Handle missing Telegram WebApp gracefully

### DON'T

- ❌ Don't access `window.Telegram.WebApp` directly
- ❌ Don't assume Telegram WebApp is available
- ❌ Don't hardcode Telegram-specific UI patterns
- ❌ Don't break web functionality for Telegram features
- ❌ Don't use Telegram APIs without fallbacks

---

## Resources

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram WebApp API Reference](https://core.telegram.org/bots/webapps#initializing-mini-apps)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
