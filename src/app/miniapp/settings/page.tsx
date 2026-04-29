'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSound } from '@/lib/sound/use-sound';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PasscodeScreen, createPinHash } from '@/components/ui/passcode-screen';
import {
  getPasscodeHash, setPasscodeHash, removePasscode,
  getLockTimer, setLockTimer, type LockTimer, LOCK_TIMER_LABELS,
} from '@/lib/passcode';
import { cn } from '@/lib/utils';
import { TIER_INFO, type SubscriptionTier } from '@/lib/stars/paywall';
import { useI18n } from '@/lib/i18n/context';
import { SUPPORTED_LOCALES, LOCALE_META, type Locale } from '@/i18n/locales';

type SetupStep = 'idle' | 'enter_current' | 'enter_current_to_disable' | 'set_new' | 'confirm_new' | 'success';

// ── OnboardingReplay — view-only onboarding slides ────────────────────────────

const ONBOARDING_SLIDES = [
  { emoji: '📓', titleKey: 'miniapp.onboarding.slide0.title', bodyKey: 'miniapp.onboarding.slide0.body', bg: 'from-indigo-950 to-slate-950' },
  { emoji: '🤖', titleKey: 'miniapp.onboarding.slide1.title', bodyKey: 'miniapp.onboarding.slide1.body', bg: 'from-violet-950 to-slate-950' },
  { emoji: '📊', titleKey: 'miniapp.onboarding.slide2.title', bodyKey: 'miniapp.onboarding.slide2.body', bg: 'from-blue-950 to-slate-950' },
  { emoji: '💡', titleKey: 'miniapp.onboarding.slide3.title', bodyKey: 'miniapp.onboarding.slide3.body', bg: 'from-amber-950 to-slate-950' },
  { emoji: '🔐', titleKey: 'miniapp.onboarding.slide4.title', bodyKey: 'miniapp.onboarding.slide4.body', bg: 'from-emerald-950 to-slate-950' },
  { emoji: '⭐', titleKey: 'miniapp.onboarding.slide5.title', bodyKey: 'miniapp.onboarding.slide5.body', bg: 'from-yellow-950 to-slate-950', isFinal: true },
];

function OnboardingReplay({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const { play } = useSound();
  const { t } = useI18n();

  // Hide the tab bar while the overlay is open
  useEffect(() => {
    const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
    document.body.setAttribute('data-sheets-open', String(prev + 1));
    return () => {
      const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
      const next = Math.max(0, cur - 1);
      if (next === 0) document.body.removeAttribute('data-sheets-open');
      else document.body.setAttribute('data-sheets-open', String(next));
    };
  }, []);

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.94 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.94 }),
  };

  const goNext = () => {
    if (index < ONBOARDING_SLIDES.length - 1) { play('SLIDE'); setDirection(1); setIndex(i => i + 1); }
    else { play('CELEBRATION'); onClose(); }
  };
  const goPrev = () => {
    if (index > 0) { play('SLIDE'); setDirection(-1); setIndex(i => i - 1); }
  };

  const slide = ONBOARDING_SLIDES[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-14',
        slide.bg,
      )}
    >
      {/* Close — top right circle button */}
      <button
        onClick={() => { play('CLOSE'); onClose(); }}
        className="absolute right-5 top-5 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/10 text-white/60 active:bg-white/20 transition-colors"
        aria-label="Закрити"
      >
        <Icon name="close" size={18} />
      </button>

      {/* Content */}
      <div className="relative flex flex-1 flex-col items-center justify-center text-center overflow-hidden w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              className="mb-8 text-8xl leading-none select-none"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            >
              {slide.emoji}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="mb-4 text-[28px] font-bold leading-tight text-white"
            >
              {t(slide.titleKey)}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35 }}
              className="max-w-xs text-[15px] leading-relaxed text-white/60"
            >
              {t(slide.bodyKey)}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="mb-8 flex gap-1.5 items-center">
        {ONBOARDING_SLIDES.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => { setDirection(i > index ? 1 : -1); play('SELECT'); setIndex(i); }}
            animate={{ width: i === index ? 16 : 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ height: 6, minWidth: 0, minHeight: 0 }}
            className={cn('rounded-full', i === index ? 'bg-white' : 'bg-white/25')}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={goNext}
          className={cn(
            'w-full rounded-2xl py-4 text-base font-semibold text-slate-950',
            (slide as { isFinal?: boolean }).isFinal ? 'bg-yellow-400' : 'bg-white'
          )}
        >
          {(slide as { isFinal?: boolean }).isFinal ? t('miniapp.onboarding.understood') : t('miniapp.onboarding.next')}
        </motion.button>
        {index > 0 && (
          <button onClick={goPrev} className="w-full py-2 text-sm text-white/40">
            {t('miniapp.onboarding.back')}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Fix: robust body attribute management for tab bar hiding
function useSheetBodyAttr(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const increment = () => {
      const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
      document.body.setAttribute('data-sheets-open', String(prev + 1));
    };
    const decrement = () => {
      const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
      const next = Math.max(0, cur - 1);
      if (next === 0) document.body.removeAttribute('data-sheets-open');
      else document.body.setAttribute('data-sheets-open', String(next));
    };
    increment();
    return decrement;
  }, [open]);
}

// ---------------------------------------------------------------------------
// LanguageSection component
// ---------------------------------------------------------------------------

function LanguageSection() {
  const { locale, setLocale, t } = useI18n();
  const { accessToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticLocale, setOptimisticLocale] = useState<Locale>(locale);

  const handleSelect = async (newLocale: Locale) => {
    if (newLocale === optimisticLocale) return;
    const prev = optimisticLocale;
    setOptimisticLocale(newLocale);
    setLocale(newLocale);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ language: newLocale }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      // Revert on failure
      setOptimisticLocale(prev);
      setLocale(prev);
      setError(t('miniapp.error.language_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('miniapp.settings.language')}
      </p>
      <Card>
        <CardContent className="p-0">
          {SUPPORTED_LOCALES.map((loc, i) => {
            const { nativeName, flag } = LOCALE_META[loc];
            const isActive = loc === optimisticLocale;
            return (
              <React.Fragment key={loc}>
                {i > 0 && <Separator />}
                <button
                  onClick={() => handleSelect(loc)}
                  disabled={saving}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  <span className="text-xl">{flag}</span>
                  <span className="flex-1 text-left text-sm font-medium">{nativeName}</span>
                  {isActive && <Icon name="check" size={16} className="text-primary" />}
                </button>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>
      {error && <p className="mt-2 px-1 text-xs text-destructive">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SoundSection component
// ---------------------------------------------------------------------------

function SoundSection() {
  const { enabled, setEnabled, play, playForced } = useSound();
  const { t } = useI18n();
  // Guard against SSR hydration mismatch — don't render toggle until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.sound')}</p>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon name={mounted && enabled ? 'volume_up' : 'volume_off'} size={16} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('miniapp.settings.sound.effects')}</p>
              <p className="text-xs text-muted-foreground">{mounted && enabled ? t('miniapp.settings.sound.enabled') : t('miniapp.settings.sound.disabled')}</p>
            </div>
            {/* Toggle switch — iOS style */}
            <button
              role="switch"
              aria-checked={mounted ? enabled : false}
              onClick={() => {
                if (!enabled) {
                  // Turning ON: enable first, then play (playForced bypasses enabled check)
                  setEnabled(true);
                  playForced('TOGGLE_ON');
                } else {
                  // Turning OFF: play first while still enabled, then disable
                  play('TOGGLE_OFF');
                  setTimeout(() => setEnabled(false), 150);
                }
              }}
              className={cn(
                'relative flex-shrink-0 rounded-full transition-colors duration-200',
                mounted && enabled ? 'bg-[#4797FF]' : 'bg-[#335B7E]'
              )}
              style={{ width: 44, height: 26, minWidth: 44, minHeight: 26 }}
            >
              <span
                className="absolute top-[3px] rounded-full bg-white shadow-sm transition-all duration-200"
                style={{
                  width: 20,
                  height: 20,
                  left: mounted && enabled ? 21 : 3,
                }}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

// ── ExportSheet ───────────────────────────────────────────────────────────────

// ── InviteSheet ───────────────────────────────────────────────────────────────

function InviteSheet({ accessToken, onClose }: { accessToken: string | null; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { play } = useSound();
  const { t } = useI18n();

  useSheetBodyAttr(true);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    // Fetch or create referral code via the bot API endpoint
    fetch('/api/profile/referral', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => { if (d.link) setLink(d.link); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleShare = () => {
    if (!link) return;
    play('OPEN');
    const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void; openLink?: (url: string) => void } } }).Telegram?.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Спробуй Memo — AI-щоденник у Telegram! 📓')}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else if (tg?.openLink) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      play('SELECT');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50"
        onClick={() => { play('CLOSE'); onClose(); }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
        className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-10 shadow-2xl"
      >
        {/* Handle */}
        <div className="mb-5 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-3xl">
              🎁
            </div>
          </div>
          <p className="text-[17px] font-bold">{t('miniapp.invite.title')}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t('miniapp.invite.desc', { days: '30' })}
          </p>
        </div>

        {/* How it works */}
        <div className="mb-5 rounded-2xl bg-muted/20 px-4 py-3 flex flex-col gap-2.5">
          {[
            { n: '1', text: t('miniapp.invite.how_it_works_1') },
            { n: '2', text: t('miniapp.invite.how_it_works_2') },
            { n: '3', text: t('miniapp.invite.how_it_works_3') },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[11px] font-bold text-amber-400">{n}</span>
              <span className="text-[13px] text-foreground/80">{text}</span>
            </div>
          ))}
        </div>

        {/* Link */}
        {loading ? (
          <div className="mb-4 h-12 rounded-xl bg-muted/40 animate-pulse" />
        ) : link ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="flex-1 text-[13px] text-muted-foreground truncate">{link}</p>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[12px] font-medium transition-colors active:bg-muted"
            >
              {copied ? t('miniapp.invite.copied') : t('miniapp.invite.copy')}
            </button>
          </div>
        ) : (
          <p className="mb-4 text-center text-[13px] text-muted-foreground">{t('miniapp.invite.link_error')}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            disabled={!link}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Icon name="share" size={16} />
            {t('miniapp.invite.share')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { play('CLOSE'); onClose(); }}
            className="w-full py-3 text-sm text-muted-foreground"
          >
            {t('miniapp.invite.close')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── ExportSheet ───────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'sending' | 'sent' | 'error';

function ExportSheet({ accessToken, onClose }: { accessToken: string | null; onClose: () => void }) {
  const [state, setState] = useState<ExportState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { play } = useSound();
  const { t } = useI18n();

  useSheetBodyAttr(true);

  const handleSend = async () => {
    if (!accessToken || state === 'sending') return;
    play('BUTTON');
    setState('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/profile/export/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Помилка сервера');
      }
      play('CELEBRATION');
      setState('sent');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не вдалося надіслати дані');
      setState('error');
      play('CAUTION');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50"
        onClick={() => { play('CLOSE'); onClose(); }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
        className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-10 shadow-2xl"
      >
        {/* Handle */}
        <div className="mb-5 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full',
            state === 'sent' ? 'bg-green-500/15' : state === 'error' ? 'bg-destructive/10' : 'bg-primary/10'
          )}>
            {state === 'sending' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                <Icon name="progress_activity" size={26} className="text-primary" />
              </motion.div>
            )}
            {state === 'sent' && <Icon name="check_circle" size={26} className="text-green-400" />}
            {state === 'error' && <Icon name="error" size={26} className="text-destructive" />}
            {state === 'idle' && <Icon name="download" size={26} className="text-primary" />}
          </div>
        </div>

        {/* Title + body */}
        <div className="mb-6 text-center">
          {state === 'idle' && (
            <>
              <p className="text-base font-semibold">{t('miniapp.export.ready')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('miniapp.export.send_via_bot_desc')}</p>
            </>
          )}
          {state === 'sending' && (
            <>
              <p className="text-base font-semibold">{t('miniapp.export.preparing')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('miniapp.export.preparing_desc')}</p>
            </>
          )}
          {state === 'sent' && (
            <>
              <p className="text-base font-semibold text-green-400">{t('miniapp.export.sent_title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('miniapp.export.sent_desc')}</p>
            </>
          )}
          {state === 'error' && (
            <>
              <p className="text-base font-semibold text-destructive">{t('miniapp.export.error')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {state === 'idle' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
            >
              <Icon name="send" size={16} />
              {t('miniapp.export.send_via_bot')}
            </motion.button>
          )}
          {state === 'error' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
            >
              {t('miniapp.export.retry')}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { play('CLOSE'); onClose(); }}
            className="w-full py-3 text-sm text-muted-foreground"
          >
            {t('miniapp.export.close')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockTimer, setLockTimerState] = useState<LockTimer>(0);
  const [step, setStep] = useState<SetupStep>('idle');
  const [pendingPin, setPendingPin] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  useEffect(() => {
    setHasPasscode(!!getPasscodeHash());
    setLockTimerState(getLockTimer());
  }, []);

  const { play } = useSound();
  const { t } = useI18n();

  const { accessToken } = useAuth();

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  // Fetch subscription tier for delete warning
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        setUserTier(d.profile?.subscription_tier ?? 'free');
        setSubscriptionEndsAt(d.profile?.subscription_ends_at ?? null);
      })
      .catch(() => {});
  }, [accessToken]);

  // Register inline sheets with body attribute so tab bar hides
  useSheetBodyAttr(showDeleteConfirm);
  useSheetBodyAttr(showExportSheet);
  useSheetBodyAttr(showInviteSheet);

  // ── Passcode handlers ─────────────────────────────────────────────────────
  const handleEnablePasscode = () => { play('OPEN'); setStep('set_new'); };
  const handleChangePasscode = () => { play('OPEN'); if (hasPasscode) setStep('enter_current'); else setStep('set_new'); };
  // Disable: require current PIN first
  const handleDisablePasscode = () => { play('OPEN'); setStep('enter_current_to_disable'); };
  const handleTimerChange = (t: LockTimer) => { setLockTimer(t); setLockTimerState(t); setShowTimerPicker(false); };

  const handleCurrentVerified = () => setStep('set_new');
  const handleCurrentVerifiedForDisable = () => {
    removePasscode();
    setHasPasscode(false);
    setStep('idle');
    play('CELEBRATION');
  };

  const handleNewPin = (pin: string) => {
    setPendingPin(pin);
    setConfirmMismatch(false);
    setStep('confirm_new');
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== pendingPin) {
      // Mismatch — show error on confirm screen then go back to set_new
      setConfirmMismatch(true);
      setTimeout(() => {
        setConfirmMismatch(false);
        setPendingPin('');
        setStep('set_new');
      }, 800);
      return;
    }
    const hash = await createPinHash(pin);
    setPasscodeHash(hash);
    setHasPasscode(true);
    setPendingPin('');
    setStep('success');
    play('CELEBRATION');
    setTimeout(() => setStep('idle'), 1800);
  };

  // ── Delete account handler ────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!accessToken) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      // Clear all local state
      removePasscode();
      localStorage.removeItem('memo_onboarding_done');
      localStorage.removeItem('memo_renewal_banner_shown_date');
      localStorage.removeItem('memo_sound_enabled');
      localStorage.removeItem('memo_sound_kit');
      // Reload to trigger onboarding
      router.push('/miniapp');
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Не вдалося видалити акаунт. Спробуйте ще раз.');
      play('CAUTION');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Passcode screens ───────────────────────────────────────────────────────
  if (step === 'enter_current') return (
    <PasscodeScreen
      key="enter_current"
      mode="enter"
      title={t('miniapp.passcode.current_title')}
      subtitle={t('miniapp.passcode.current_subtitle')}
      stepCurrent={1} stepTotal={3}
      expectedHash={getPasscodeHash() ?? undefined}
      onSuccess={handleCurrentVerified}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'enter_current_to_disable') return (
    <PasscodeScreen
      key="enter_current_to_disable"
      mode="enter"
      title={t('miniapp.passcode.confirm_disable_title')}
      subtitle={t('miniapp.passcode.confirm_disable_subtitle')}
      expectedHash={getPasscodeHash() ?? undefined}
      onSuccess={handleCurrentVerifiedForDisable}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'set_new') return (
    <PasscodeScreen
      key="set_new"
      mode="set"
      title={t('miniapp.passcode.new_title')}
      subtitle={t('miniapp.passcode.new_subtitle')}
      stepCurrent={hasPasscode ? 2 : 1} stepTotal={hasPasscode ? 3 : 2}
      onSuccess={handleNewPin}
      onCancel={() => setStep('idle')}
    />
  );
  if (step === 'confirm_new') return (
    <PasscodeScreen
      key="confirm_new"
      mode="confirm"
      title={t('miniapp.passcode.confirm_title')}
      subtitle={t('miniapp.passcode.confirm_subtitle')}
      stepCurrent={hasPasscode ? 3 : 2} stepTotal={hasPasscode ? 3 : 2}
      mismatch={confirmMismatch}
      onSuccess={handleConfirmPin}
      onCancel={() => { setStep('idle'); setPendingPin(''); }}
    />
  );
  if (step === 'success') return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-400/15">
        <span className="text-5xl">🔐</span>
      </div>
      <p className="text-[22px] font-bold text-green-400">{t('miniapp.settings.passcode_set')}</p>
      <p className="text-[14px] text-muted-foreground">{t('miniapp.settings.passcode_set_desc')}</p>
    </div>
  );

  const TIMERS: LockTimer[] = [0, 1, 5, 15, 60];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-6 px-4 pt-5 pb-6"
    >

      {/* ── Підписка ────────────────────────────────────────────────────── */}
      <motion.section
        id="subscription"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.subscription')}</h2>

        <Card>
          <CardContent className="p-0">
            <a href="/miniapp/subscriptions"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 shrink-0">
                <span className="text-base leading-none">
                  {userTier ? (TIER_INFO[userTier as SubscriptionTier]?.icon ?? '⭐') : '⭐'}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium">
                  {userTier && userTier !== 'free'
                    ? TIER_INFO[userTier as SubscriptionTier]?.name ?? t('miniapp.settings.subscription')
                    : t('miniapp.settings.upgrade_plan')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userTier === 'free' || !userTier
                    ? t('miniapp.settings.subscription_unlock')
                    : (() => {
                        if (!subscriptionEndsAt) return t('miniapp.settings.manage_subscription');
                        const isExpired = new Date(subscriptionEndsAt) < new Date();
                        if (isExpired) return t('miniapp.settings.subscription_expired');
                        const daysLeft = Math.ceil((new Date(subscriptionEndsAt).getTime() - Date.now()) / 86400000);
                        return t('miniapp.settings.subscription_active', { days: String(daysLeft) });
                      })()}
                </p>
              </div>
              {userTier && userTier !== 'free' && subscriptionEndsAt && (() => {
                const isExpired = new Date(subscriptionEndsAt) < new Date();
                return isExpired
                  ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive shrink-0">{t('miniapp.settings.status_expired')}</span>
                  : <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400 shrink-0">{t('miniapp.settings.status_active')}</span>;
              })()}
              {(!userTier || userTier === 'free') && (
                <Icon name="chevron_right" size={16} className="text-muted-foreground shrink-0" />
              )}
              {userTier && userTier !== 'free' && (
                <Icon name="chevron_right" size={16} className="text-muted-foreground shrink-0" />
              )}
            </a>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Запросити друзів ─────────────────────────────────────────────── */}
      <motion.section
        id="invite"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.invite')}</h2>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => { play('OPEN'); setShowInviteSheet(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15">
                <span className="text-base leading-none">🎁</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium">{t('miniapp.settings.invite_friend')}</p>
                <p className="text-xs text-muted-foreground truncate">{t('miniapp.settings.invite_friend_desc')}</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground shrink-0" />
            </motion.button>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Приватність та безпека ────────────────────────────────────────── */}
      <motion.section
        id="privacy"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.privacy')}</h2>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99, backgroundColor: 'rgba(255,255,255,0.03)' }}
              onClick={hasPasscode ? handleChangePasscode : handleEnablePasscode}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
              onClickCapture={() => play('OPEN')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {hasPasscode ? <Icon name="password" size={16} className="text-primary" /> : <Icon name="lock" size={16} className="text-primary" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{hasPasscode ? t('miniapp.settings.change_passcode') : t('miniapp.settings.enable_passcode')}</p>
                <p className="text-xs text-muted-foreground">{hasPasscode ? t('miniapp.settings.change_passcode_desc') : t('miniapp.settings.enable_passcode_desc')}</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </motion.button>

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <div>
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { play('SELECT'); setShowTimerPicker(v => !v); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Icon name="timer" size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('miniapp.settings.lock_timer')}</p>
                    <p className="text-xs text-muted-foreground">{LOCK_TIMER_LABELS[lockTimer]}</p>
                  </div>
                  <Icon name="chevron_right" size={16} className={cn('text-muted-foreground transition-transform', showTimerPicker && 'rotate-90')} />
                </motion.button>
                <AnimatePresence>
                  {showTimerPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="overflow-hidden border-t"
                    >
                      <div className="pb-1">
                        {TIMERS.map(t => (
                          <motion.button
                            key={t}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTimerChange(t)}
                            className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                          >
                            <span className={cn(t === lockTimer && 'font-medium text-primary')}>{LOCK_TIMER_LABELS[t]}</span>
                            {t === lockTimer && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              >
                                <Icon name="check" size={16} className="text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {hasPasscode && <Separator />}

            {hasPasscode && (
              <motion.button
                whileTap={{ scale: 0.99 }}
                onClick={handleDisablePasscode}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                  <Icon name="lock_open" size={16} className="text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{t('miniapp.settings.disable_passcode')}</p>
                  <p className="text-xs text-destructive/60">{t('miniapp.settings.disable_passcode_desc')}</p>
                </div>
              </motion.button>
            )}
            <Separator />
            {/* Export data */}
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => { play('OPEN'); setShowExportSheet(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="download" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.export_data')}</p>
                <p className="text-xs text-muted-foreground">{t('miniapp.settings.export_data_desc')}</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </motion.button>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Звук ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <SoundSection />
      </motion.div>

      {/* ── Мова ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <LanguageSection />
      </motion.div>

      {/* ── Підтримка ─────────────────────────────────────────────────────── */}
      <motion.section
        id="support"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.31, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.support')}</h2>
        <Card>
          <CardContent className="p-0">
            <motion.a
              whileTap={{ scale: 0.99 }}
              href="https://t.me/get_memo_help"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="support_agent" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.support_chat')}</p>
                <p className="text-xs text-muted-foreground">@get_memo_help</p>
              </div>
              <Icon name="open_in_new" size={16} className="text-muted-foreground" />
            </motion.a>
            <Separator />
            <motion.a
              whileTap={{ scale: 0.99 }}
              href="https://t.me/get_memo_updates"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => play('OPEN')}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="campaign" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.updates_channel')}</p>
                <p className="text-xs text-muted-foreground">{t('miniapp.settings.updates_channel_desc')}</p>
              </div>
              <Icon name="open_in_new" size={16} className="text-muted-foreground" />
            </motion.a>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Про додаток ───────────────────────────────────────────────────── */}
      <motion.section
        id="about"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.31, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.about')}</h2>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => { play('OPEN'); setShowOnboarding(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="auto_stories" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.how_to_use')}</p>
                <p className="text-xs text-muted-foreground">{t('miniapp.settings.how_to_use_desc')}</p>
              </div>
              <Icon name="chevron_right" size={16} className="text-muted-foreground" />
            </motion.button>
            <Separator />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Icon name="info" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.version')}</p>
                <p className="text-xs text-muted-foreground">Memo 1.0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── Акаунт ─────────────────────────────────────────────────── */}
      <motion.section
        id="account"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('miniapp.settings.account')}</h2>
        <Card>
          <CardContent className="p-0">
            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={() => { play('CAUTION'); setShowDeleteConfirm(true); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive transition-colors hover:bg-destructive/5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <Icon name="delete_forever" size={16} className="text-destructive" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{t('miniapp.settings.delete_account')}</p>
                <p className="text-xs text-destructive/70">{t('miniapp.settings.delete_account_desc')}</p>
              </div>
            </motion.button>
          </CardContent>
        </Card>
      </motion.section>

      {/* Onboarding replay */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingReplay onClose={() => setShowOnboarding(false)} />
        )}
      </AnimatePresence>

      {/* Invite sheet */}
      <AnimatePresence>
        {showInviteSheet && (
          <InviteSheet
            accessToken={accessToken}
            onClose={() => setShowInviteSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* Export sheet */}
      <AnimatePresence>
        {showExportSheet && (
          <ExportSheet
            accessToken={accessToken}
            onClose={() => setShowExportSheet(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete account confirmation sheet */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
              className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl"
            >
              <div className="mb-4 flex justify-center">
                <motion.div
                  className="h-1 w-10 rounded-full bg-muted"
                  whileHover={{ scaleX: 1.2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto"
              >
                <Icon name="delete_forever" size={24} className="text-destructive" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.25 }}
              >
                <h3 className="mb-1 text-center text-base font-semibold">{t('miniapp.delete.title')}</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  {t('miniapp.delete.desc')}
                </p>

                {/* Subscription warning */}
                {userTier && userTier !== 'free' && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3">
                    <span className="text-lg leading-none shrink-0">⚠️</span>
                    <p className="text-[13px] text-amber-300 leading-snug">
                      {t('miniapp.delete.subscription_warning', { tier: userTier === 'stars_pro' ? 'Memo Supernova' : 'Memo Nova' })}
                    </p>
                  </div>
                )}

                {deleteError && <p className="mb-3 text-center text-xs text-destructive">{deleteError}</p>}
                <div className="flex flex-col gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { play('BUTTON'); handleDeleteAccount(); }}
                    disabled={deleteLoading}
                    className="w-full rounded-full bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    {deleteLoading ? t('miniapp.delete.deleting') : t('miniapp.delete.confirm')}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { play('CLOSE'); setShowDeleteConfirm(false); setDeleteError(null); }}
                    className="w-full py-3 text-sm text-muted-foreground"
                  >
                    {t('miniapp.delete.cancel')}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
