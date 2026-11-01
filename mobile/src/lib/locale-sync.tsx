import { useEffect } from 'react';
import { api } from './api';
import { useSession } from './session';
import { getLocale, isLocale, setLocale } from '../i18n';
import { storeLocale } from './app-state';

/**
 * When a signed-in session starts, the language saved on the account wins over the
 * device choice, so the app matches the Mini App and the bot.
 */
export function ServerLanguageSync() {
  const { token, live } = useSession();

  useEffect(() => {
    if (!live || !token) return;
    let active = true;
    api
      .getSettings(token)
      .then(({ language }) => {
        if (!active || !isLocale(language) || language === getLocale()) return;
        setLocale(language);
        void storeLocale(language);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [live, token]);

  return null;
}
