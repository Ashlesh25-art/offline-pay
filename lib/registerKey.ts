import { getPublicKeyHex, getUserId } from "./cryptoKeys";
import { API_BASE_URL } from "./api";

export async function registerPublicKeyIfNeeded() {
  const userId = await getUserId();
  const pub = await getPublicKeyHex();
  if (!userId || !pub) return;

  try {
    await fetch(`${API_BASE_URL}/api/register-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, publicKeyHex: pub }),
    });
  } catch (e) {
    console.log("Could not register public key (network may be offline):", e);
  }
}
