function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKeyFromSecret(secret: bigint): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret.toString(10));
  const hash = await crypto.subtle.digest("SHA-256", secretBytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptDocumentBody(secret: bigint, plaintext: string): Promise<string> {
  const key = await deriveAesKeyFromSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const clearBytes = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, clearBytes);
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptDocumentBody(secret: bigint, payload: string): Promise<string> {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Unsupported encrypted body format");
  }

  const key = await deriveAesKeyFromSecret(secret);
  const iv = base64ToBytes(parts[1]);
  const ciphertext = base64ToBytes(parts[2]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const decoder = new TextDecoder();
  return decoder.decode(clear);
}

