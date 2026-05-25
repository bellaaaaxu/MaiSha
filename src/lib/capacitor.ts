import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setOverlaysWebView({ overlay: true });
  await SplashScreen.hide();
}
