import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.myq.siltflow",
  appName: "Siltflow",
  webDir: "dist",
  server: {
    androidScheme: "http",
    hostname: "app",
    cleartext: true,
  },
  loggingBehavior: "debug",
  plugins: {
    CapacitorSQLite: {
      androidForceInMemory: false,
    },
  },
};

export default config;
