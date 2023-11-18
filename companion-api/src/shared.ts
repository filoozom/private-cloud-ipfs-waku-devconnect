import {
  generatePrivateKey,
  getPublicKey,
} from "@waku/message-encryption/ecies";
import { createHash } from "node:crypto";
import { subscribeToKey } from "./waku.js";
import { readFile, writeFile } from "node:fs/promises";
import { equals } from "uint8arrays";

// Types
export type Key = {
  privateKey: Uint8Array;
  publicKey: Uint8Array; // remote public key (not linked to private key)
  metadata: Metadata;
};

export type TempKey = {
  privateKey: Uint8Array;
  expiry: number;
};

export type Metadata = {
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

export const keys: Record<string, Key | undefined> = await loadKeys();
export let tempKey: TempKey | undefined;

// Expires after 5 seconds
// TODO: Listen to registration topic for that key
export const generateTempKey = () => {
  if (tempKey) {
    return toHex(getPublicKey(tempKey.privateKey));
  }

  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  const expiry = Date.now() + 5 * 60 * 1000;
  const hex = toHex(publicKey);

  tempKey = { privateKey, expiry };
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

  if (!tempKey || !equals(localKeyArray, getPublicKey(tempKey.privateKey))) {
    throw new Error("Invalid key");
  }

  if (tempKey.expiry < Date.now()) {
    throw new Error("Key expired");
  }

  keys[localKey] = {
    privateKey: tempKey.privateKey,
    publicKey: fromHex(remoteKey),
    metadata,
  };
  tempKey = undefined;

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
  return tempKey && equals(localKey, getPublicKey(tempKey.privateKey));
};

// On start, subscribe to all keys
console.log({ keys });
for (const key of Object.values(keys)) {
  console.log(key);
  key && subscribeToKey(key.privateKey);
}
