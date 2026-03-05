import "react-native-get-random-values";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { requestNotificationPermission } from "../lib/notifications";

export default function RootLayout() {
  // Request push notification permission once when the app opens
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="merchant-login" />
      <Stack.Screen name="merchant-register" />
      <Stack.Screen name="merchant-forgot-password" />
      <Stack.Screen name="user" />
      <Stack.Screen name="merchant" />
    </Stack>
  );
}
