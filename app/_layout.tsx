import "react-native-get-random-values";
import { Stack } from "expo-router";

export default function RootLayout() {
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
