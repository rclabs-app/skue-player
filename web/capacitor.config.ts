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
    }
  }
};

export default config;
