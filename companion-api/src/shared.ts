import {
  generatePrivateKey,
  getPublicKey,
} from "@waku/message-encryption/ecies";
import { createHash } from "node:crypto";
import { subscribeToKey } from "./waku.js";
import { readFile, writeFile } from "node:fs/promises";

// Types
type Key = {
  privateKey: Uint8Array;
  publicKey: Uint8Array; // remote public key (not linked to private key)
  metadata: Metadata;
};

type TempKey = {
  privateKey: Uint8Array;
  expiry: number;
};

type Metadata = {
  name: string;
};

export const toHex = (array: Uint8Array) => Buffer.from(array).toString("hex");
export const fromHex = (hex: string): Uint8Array => Buffer.from(hex, "hex");

const loadKeys = async () => {
  try {
    const data = await readFile("keys.json", "utf-8");
    return JSON.parse(data, (key, value) => {
      return key === "privateKey" || key === "publicKey"
        ? fromHex(value)
        : value;
    });
  } catch (err) {
    return {};
  }
};

const writeKeys = async (keys: Record<string, Key | undefined>) => {
  const data = JSON.stringify(keys, (key, value) => {
    return key === "privateKey" || key === "publicKey" ? toHex(value) : value;
  });
  await writeFile("keys.json", data);
};

// TODO: Store locally
const keys: Record<string, Key | undefined> = await loadKeys();
const tempKeys: Record<string, TempKey | undefined> = {};

// Expires after 5 seconds
// TODO: Listen to registration topic for that key
export const generateTempKey = () => {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  const expiry = Date.now() + 5 * 60 * 1000;
  const hex = toHex(publicKey);

  tempKeys[hex] = { privateKey, expiry };
  subscribeToKey(privateKey);
  return hex;
};

// TODO: Listen to management topic for that key
export const register = (
  localKeyArray: Uint8Array,
  remoteKeyArray: Uint8Array,
  metadata: Metadata
) => {
  const localKey = toHex(localKeyArray);
  const remoteKey = toHex(remoteKeyArray);
  const tempKey = tempKeys[localKey];

  if (!tempKey) {
    throw new Error("Key not found");
  }

  if (tempKey.expiry < Date.now()) {
    throw new Error("Key expired");
  }

  keys[localKey] = {
    privateKey: tempKey.privateKey,
    publicKey: fromHex(remoteKey),
    metadata,
  };
  delete tempKeys[localKey];

  writeKeys(keys);
};

export const hashTopic = (text: string) => {
  return createHash("sha256").update(text).digest("hex").substring(0, 16);
};

export const getKey = (localKey: Uint8Array) => {
  return keys[toHex(localKey)];
};

export const isRegistered = (localKey: Uint8Array) => {
  return !!keys[toHex(localKey)];
};

export const isTemporaryKey = (localKey: Uint8Array) => {
  return !!tempKeys[toHex(localKey)];
};

// On start, subscribe to all keys
console.log({ keys });
for (const key of Object.values(keys)) {
  console.log(key);
  key && subscribeToKey(key.privateKey);
}
