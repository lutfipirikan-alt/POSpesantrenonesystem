import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pesantren.onesystem',
  appName: 'Pesantren One System',
  webDir: 'dist',
  // skema https di WebView → Web NFC juga aktif di dalam APK
  androidScheme: 'https',
  server: {
    // Saat development, arahkan ke server lokal komputer (ganti IP):
    // url: 'http://192.168.1.15:4173',
    // cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
