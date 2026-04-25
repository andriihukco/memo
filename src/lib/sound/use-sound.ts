'use client';
import { useContext } from 'react';
import { SoundContext, type SoundContextValue } from './sound-context';

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}
