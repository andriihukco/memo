'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { SoundProvider } from '@/lib/sound/sound-context';
import { ReportGenerationProvider } from '@/lib/report-generation-context';
import { TelegramThemeBridge } from '@/components/shell/telegram-theme-bridge';
import { Boot } from '@/components/shell/boot';
import { AppShell } from '@/components/shell/app-shell';

// ── PostHog initialisation (client-side only) ─────────────────────────────────
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We handle pageviews manually
    capture_pageleave: true,
  });
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>
        <TelegramThemeBridge />
        <SoundProvider>
          <ReportGenerationProvider>
            <Boot>
              <AppShell>{children}</AppShell>
            </Boot>
          </ReportGenerationProvider>
        </SoundProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
