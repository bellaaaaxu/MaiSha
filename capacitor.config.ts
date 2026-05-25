import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maisha.app',
  appName: '买啥',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#07c160',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
