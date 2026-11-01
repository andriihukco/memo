import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { checkPin } from '../lib/app-state';
import { PinPad } from './pin-pad';
import { useThemed, type Theme } from '../theme/theme';

/** Shown on launch when a passcode is set. Stays until the right code is entered. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { styles } = useThemed(makeStyles);
  const [error, setError] = useState<string | null>(null);

  const attempt = async (pin: string) => {
    if (await checkPin(pin)) {
      onUnlock();
    } else {
      setError('Wrong passcode');
    }
  };

  return (
    <View style={styles.screen}>
      <PinPad title="Enter passcode" error={error} onComplete={(pin) => void attempt(pin)} />
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 80 },
});
