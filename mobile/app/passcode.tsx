import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { t } from '../src/i18n';
import { checkPin, removePin, setPin } from '../src/lib/app-state';
import { PinPad } from '../src/components/pin-pad';
import { useThemed, type Palette } from '../src/theme/theme';

/** Enable, change or disable the 4-digit passcode. Each step asks for one code. */
export default function PasscodeScreen() {
  const { styles } = useThemed(makeStyles);
  const { mode } = useLocalSearchParams<{ mode: 'enable' | 'change' | 'disable' }>();
  const [stage, setStage] = useState<'current' | 'new' | 'confirm'>(mode === 'enable' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = () => router.back();

  const onComplete = async (pin: string) => {
    if (stage === 'current') {
      if (!(await checkPin(pin))) {
        setError('Wrong passcode');
        return;
      }
      if (mode === 'disable') {
        await removePin();
        done();
        return;
      }
      setError(null);
      setStage('new');
      return;
    }
    if (stage === 'new') {
      setFirst(pin);
      setError(null);
      setStage('confirm');
      return;
    }
    if (pin !== first) {
      setError('Codes do not match');
      setStage('new');
      return;
    }
    await setPin(pin);
    done();
  };

  const title =
    stage === 'current'
      ? 'Enter current passcode'
      : stage === 'new'
        ? t('miniapp.passcode.new_title')
        : t('miniapp.passcode.confirm_title');
  const sub =
    stage === 'current'
      ? undefined
      : t(stage === 'new' ? 'miniapp.passcode.new_subtitle' : 'miniapp.passcode.confirm_subtitle');

  return (
    <View style={styles.screen}>
      <PinPad title={title} subtitle={sub} error={error} onComplete={(pin) => void onComplete(pin)} />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 80 },
});
