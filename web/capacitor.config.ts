import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rclabs.player',
  appName: 'rcplayer',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0f171e",
      androidSplashResourceName: "splash",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#2563eb",
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  backgroundColor: '#0f171e'
};

export default config;
