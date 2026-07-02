import { useCallback, useRef } from 'react';
import type {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

const SCANNER_CHAR_GAP_MS = 50;

type UseBarcodeInputOptions = {
  onScan: (barcode: string) => void;
};

export function useBarcodeInput({ onScan }: UseBarcodeInputOptions) {
  const bufferRef = useRef('');
  const lastCharAtRef = useRef(0);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    lastCharAtRef.current = 0;
  }, []);

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = event.nativeEvent.key;
      const now = Date.now();
      const elapsed = lastCharAtRef.current ? now - lastCharAtRef.current : 0;

      if (key === 'Enter') {
        const barcode = bufferRef.current.trim();
        resetBuffer();

        if (barcode) {
          onScan(barcode);
        }

        return;
      }

      if (key.length !== 1) {
        return;
      }

      if (lastCharAtRef.current && elapsed > SCANNER_CHAR_GAP_MS) {
        bufferRef.current = key;
      } else {
        bufferRef.current += key;
      }

      lastCharAtRef.current = now;
    },
    [onScan, resetBuffer],
  );

  return {
    handleKeyPress,
    resetBuffer,
  };
}
