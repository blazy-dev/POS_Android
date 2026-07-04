import { Audio } from 'expo-av';
import { Vibration } from 'react-native';

const successSoundAsset = require('../../assets/sounds/success.mp3');
const errorSoundAsset = require('../../assets/sounds/error.mp3');

let successSound: Audio.Sound | null = null;
let errorSound: Audio.Sound | null = null;

// Precarga e inicializa las instancias de audio globales para evitar latencia de lectura de disco
async function getSuccessSoundInstance(): Promise<Audio.Sound> {
  if (successSound) return successSound;
  const { sound } = await Audio.Sound.createAsync(successSoundAsset);
  successSound = sound;
  return sound;
}

async function getErrorSoundInstance(): Promise<Audio.Sound> {
  if (errorSound) return errorSound;
  const { sound } = await Audio.Sound.createAsync(errorSoundAsset);
  errorSound = sound;
  return sound;
}

export async function playSuccessSound() {
  try {
    const sound = await getSuccessSoundInstance();
    // Reproduce inmediatamente desde el inicio sin volver a crear la instancia
    await sound.replayAsync();
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de éxito:', error);
    // Fallback: si falla la instancia cacheada, intenta recrear una sola vez
    try {
      successSound = null;
      const sound = await getSuccessSoundInstance();
      await sound.playAsync();
    } catch {}
  }
}

export async function playErrorSound() {
  try {
    // Vibración de alerta: 100ms vibrar, 50ms silencio, 100ms vibrar (patrón de error)
    Vibration.vibrate([0, 100, 50, 100]);
    const sound = await getErrorSoundInstance();
    await sound.replayAsync();
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de error:', error);
    try {
      errorSound = null;
      const sound = await getErrorSoundInstance();
      await sound.playAsync();
    } catch {}
  }
}
