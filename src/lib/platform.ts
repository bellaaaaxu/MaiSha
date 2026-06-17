import { Capacitor } from '@capacitor/core';

/** Store-finder is iOS-only (MapKit). Entry points hide elsewhere. */
export function isStoreFinderAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios';
}
