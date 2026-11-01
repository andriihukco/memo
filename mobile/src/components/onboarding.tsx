import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInRight, FadeOut, FadeOutLeft, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { t, setLocale, locale } from '../i18n';
import { setPin, markOnboarded } from '../lib/app-state';
import { TOUCH } from './ui';
import { Symbol } from './symbol';
import { PinPad } from './pin-pad';
import { useThemed, type Theme } from '../theme/theme';

/** Six slides, same copy as the Mini App. Each has an SF Symbol and a tint. */
const SLIDES = [
  { symbol: 'book.closed.fill', key: 'slide0', tint: '#818CF8' },
  { symbol: 'sparkles', key: 'slide1', tint: '#A78BFA' },
  { symbol: 'chart.bar.xaxis', key: 'slide2', tint: '#60A5FA' },
  { symbol: 'lightbulb.fill', key: 'slide3', tint: '#FBBF24' },
  { symbol: 'lock.shield.fill', key: 'slide4', tint: '#34D399' },
  { symbol: 'star.circle.fill', key: 'slide5', tint: '#FACC15' },
] as const;

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
];

const SPRING = { damping: 22, stiffness: 240 };

type Step = 'language' | 'slides' | 'passcode-ask' | 'passcode-set' | 'passcode-confirm' | 'paywall';

/** Plan step after the passcode. Off while billing is hidden, so onboarding ends at the passcode. */
const SHOW_PLAN_STEP = false;

/**
 * Apple-style first run: one job per screen, a single prominent action at the
 * bottom, Skip always reachable, swipeable slides with page dots, and haptics.
 * Order: language → slides → passcode (optional) → plan.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { colors, styles } = useThemed(makeStyles);
  const [step, setStep] = useState<Step>('language');
  const [index, setIndex] = useState(0);
  const [firstPin, setFirstPin] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [, rerender] = useState(0);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await markOnboarded();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  };

  const afterPasscode = () => {
    if (SHOW_PLAN_STEP) setStep('paywall');
    else void finish();
  };

  const goSlide = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View style={styles.root}>
      {step === 'language' ? (
        <Animated.View key="language" entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(200)} style={styles.page}>
          <Text style={[styles.largeTitle, { fontFamily: colors.heading }]} accessibilityRole="header">{t('miniapp.onboarding.language_picker.title')}</Text>
          <Text style={styles.sub}>{t('miniapp.onboarding.language_picker.subtitle')}</Text>
          <View style={styles.group}>
            {LANGUAGES.map((l, i) => {
              const selected = locale === l.code;
              return (
                <Pressable
                  key={l.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setLocale(l.code);
                    void Haptics.selectionAsync();
                    rerender((n) => n + 1);
                  }}
                  style={[styles.langRow, i > 0 && styles.border]}
                >
                  <Text style={styles.rowTitle}>{l.label}</Text>
                  {selected ? <Symbol name="checkmark" size={18} color={colors.tint} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          <Cta label={t('miniapp.onboarding.next')} onPress={() => setStep('slides')} />
        </Animated.View>
      ) : null}

      {step === 'slides' ? (
        <Animated.View key="slides" entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.page}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={() => setStep('passcode-ask')} style={styles.skip} hitSlop={8}>
              <Text style={styles.skipLabel}>{t('miniapp.onboarding.skip')}</Text>
            </Pressable>
          </View>
          <FlatList
            ref={listRef}
            data={SLIDES as unknown as (typeof SLIDES)[number][]}
            keyExtractor={(s) => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== index) {
                setIndex(i);
                void Haptics.selectionAsync();
              }
            }}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width }]}>
                <View style={[styles.heroCircle, { backgroundColor: item.tint + '22' }]}>
                  <Symbol name={item.symbol as never} size={84} color={item.tint} weight="medium" />
                </View>
                <Text style={styles.largeTitle}>{t(`miniapp.onboarding.${item.key}.title`)}</Text>
                <Text style={styles.body}>{t(`miniapp.onboarding.${item.key}.body`)}</Text>
              </View>
            )}
          />
          <PageDots count={SLIDES.length} index={index} />
          <Cta
            label={index === SLIDES.length - 1 ? t('miniapp.onboarding.start_free') : t('miniapp.onboarding.next')}
            onPress={() => (index === SLIDES.length - 1 ? setStep('passcode-ask') : goSlide(index + 1))}
          />
        </Animated.View>
      ) : null}

      {step === 'passcode-ask' ? (
        <Animated.View key="passcode-ask" entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(200)} style={styles.page}>
          <View style={styles.hero}>
            <View style={[styles.heroCircle, { backgroundColor: colors.tintFill + '22' }]}>
              <Symbol name="lock.fill" size={72} color={colors.tint} weight="medium" />
            </View>
            <Text style={[styles.largeTitle, { fontFamily: colors.heading }]} accessibilityRole="header">{t('miniapp.onboarding.passcode.title')}</Text>
            <Text style={styles.body}>{t('miniapp.onboarding.passcode.desc')}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Cta label={t('miniapp.onboarding.passcode.set')} onPress={() => setStep('passcode-set')} />
          <Pressable accessibilityRole="button" onPress={() => afterPasscode()} style={styles.textAction}>
            <Text style={styles.textActionLabel}>{t('miniapp.onboarding.passcode.skip')}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 'passcode-set' || step === 'passcode-confirm' ? (
        <Animated.View key={step} entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)} style={styles.page}>
          <PinPad
            title={t(step === 'passcode-confirm' ? 'miniapp.passcode.confirm_title' : 'miniapp.passcode.new_title')}
            subtitle={mismatch ? 'Codes do not match, try again' : t(step === 'passcode-confirm' ? 'miniapp.passcode.confirm_subtitle' : 'miniapp.passcode.new_subtitle')}
            onComplete={async (pin) => {
              if (step === 'passcode-set') {
                setFirstPin(pin);
                setMismatch(false);
                setStep('passcode-confirm');
                return;
              }
              if (pin !== firstPin) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setMismatch(true);
                setStep('passcode-set');
                return;
              }
              await setPin(pin);
              afterPasscode();
            }}
          />
        </Animated.View>
      ) : null}

      {step === 'paywall' ? (
        <Animated.View key="paywall" entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(200)} style={styles.page}>
          <Text style={[styles.largeTitle, { fontFamily: colors.heading }]} accessibilityRole="header">{t('miniapp.onboarding.paywall.title')}</Text>
          <Text style={styles.sub}>{t('miniapp.onboarding.paywall.subtitle')}</Text>
          <LinearGradient colors={[colors.separator, colors.card]} style={styles.planCard}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.planName}>{t('miniapp.onboarding.paywall.free_forever')}</Text>
              <Text style={styles.planSub}>{t('miniapp.onboarding.paywall.subtitle')}</Text>
            </View>
            <Symbol name="checkmark.seal.fill" size={28} color={colors.tint} />
          </LinearGradient>
          <View style={{ flex: 1 }} />
          <Cta label={t('miniapp.onboarding.paywall.continue_free')} onPress={() => void finish()} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Pill-shaped primary action. Springs on press. */
function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useThemed(makeStyles);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.97, SPRING));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, SPRING));
      }}
    >
      <Animated.View style={[styles.cta, style]}>
        <Text style={styles.ctaLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Dots where the active one stretches into a pill, animated. */
function PageDots({ count, index }: { count: number; index: number }) {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const { styles } = useThemed(makeStyles);
  const width = useSharedValue(active ? 22 : 8);
  const opacity = useSharedValue(active ? 1 : 0.3);
  useEffect(() => {
    width.value = withTiming(active ? 22 : 8, { duration: 220 });
    opacity.value = withTiming(active ? 1 : 0.3, { duration: 220 });
  }, [active, width, opacity]);
  const style = useAnimatedStyle(() => ({ width: width.value, opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 40, gap: 16 },
  topRow: { flexDirection: 'row', position: 'absolute', top: 60, left: 0, right: 16, zIndex: 2 },
  skip: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 8, marginLeft: 'auto' },
  skipLabel: { fontSize: colors.fs(17), color: colors.tint },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  heroCircle: { width: 176, height: 176, borderRadius: 88, alignItems: 'center', justifyContent: 'center' },
  largeTitle: { fontSize: colors.fs(32), fontWeight: '700', color: colors.label, textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontSize: colors.fs(17), color: colors.muted, textAlign: 'center' },
  body: { fontSize: colors.fs(17), lineHeight: 24, color: colors.secondary, textAlign: 'center' },
  group: { borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden', marginTop: 8 },
  langRow: { minHeight: TOUCH + 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowTitle: { fontSize: colors.fs(17), color: colors.label },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  dot: { height: 8, borderRadius: 4, backgroundColor: colors.label },
  cta: { minHeight: 54, borderRadius: 27, backgroundColor: colors.tintFill, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { color: colors.onTint, fontSize: colors.fs(17), fontWeight: '600' },
  textAction: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  textActionLabel: { fontSize: colors.fs(17), color: colors.secondary },
  planCard: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  planName: { fontSize: colors.fs(20), fontWeight: '600', color: colors.label },
  planSub: { fontSize: colors.fs(15), color: colors.muted },
});
