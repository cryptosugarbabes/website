export {};

declare global {
  interface Window {
    CryptoSugarAndroid?: {
      requestPushNotifications(): void;
      refreshPushToken(): void;
      disablePushNotifications(): void;
      getAppVersion(): string;
    };
  }
}
