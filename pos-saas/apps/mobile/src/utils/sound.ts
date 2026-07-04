import { Audio } from 'expo-av';

// Carga estática de recursos locales usando require (Metro bundler compatible)
const successSoundAsset = require('../../assets/sounds/success.mp3');
const errorSoundAsset = require('../../assets/sounds/error.mp3');

export async function playSuccessSound() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      successSoundAsset,
      { shouldPlay: true }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de éxito:', error);
  }
}

export async function playErrorSound() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      errorSoundAsset,
      { shouldPlay: true }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de error:', error);
  }
}
