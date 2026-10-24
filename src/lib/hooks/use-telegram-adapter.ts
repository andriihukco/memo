'use client';

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
