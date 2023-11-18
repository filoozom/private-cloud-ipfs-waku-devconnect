import {
  DecodedMessage,
  createDecoder,
  createEncoder,
  getPublicKey,
} from "@waku/message-encryption/ecies";
import {
  fromHex,
  getKey,
  hashTopic,
  isRegistered,
  isTemporaryKey,
  register,
  toHex,
} from "./shared.js";
import { IFilterSubscription } from "@waku/sdk";
import { getNode } from "./node.js";
import { equals } from "uint8arrays/equals";
import { unixfs } from "./helia.js";

let subscription: IFilterSubscription | undefined;

const getTopic = (publicKey: Uint8Array) => {
  const hash = hashTopic(toHex(publicKey));
  return `/cloud-companion/1/${hash}/json`;
};

const getEncoder = (
  localPublicKey: Uint8Array,
  remotePublicKey: Uint8Array,
  privateKey: Uint8Array
) => {
  const topic = getTopic(localPublicKey);
  return createEncoder({
    contentTopic: topic,
    ephemeral: true,
    publicKey: remotePublicKey,
    sigPrivKey: privateKey,
  });
};

const getSubscription = async () => {
  if (subscription) {
    return subscription;
  }

  // TODO: Clean this up, it's somewhat of a hack for the bad hackathon wifi
  while (true) {
    try {
      const node = await getNode();
      return (subscription = await node.filter.createSubscription());
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

const decodePayload = (message: DecodedMessage) => {
  const string = new TextDecoder().decode(message.payload);
  return JSON.parse(string);
};

const encodePayload = (json: unknown) => {
  const data = JSON.stringify(json);
  return new TextEncoder().encode(data);
};

// TODO: Can this be front-ran? I don't think so because the content-topic is
// a hash of the public key, so you wouldn't know how to encrypt the data
const callback = async (publicKey: Uint8Array, message: DecodedMessage) => {
  if (!message.payload) {
    console.debug("no payload");
    return;
  }

  if (!message.signaturePublicKey) {
    console.debug("no signer");
    return;
  }

  if (isTemporaryKey(publicKey)) {
    // TODO: Validate input
    // TODO: Use protobuf
    const json = decodePayload(message);

    try {
      register(publicKey, message.signaturePublicKey, json);
    } catch (err) {
      console.error("register error", err);
      return;
    }

    const key = getKey(publicKey);
    if (!key) {
      console.error("key not correctly registered, shouldn't happen");
      return;
    }

    // Reply with a success message
    const node = await getNode();
    const encoder = getEncoder(
      publicKey,
      message.signaturePublicKey,
      key.privateKey
    );
    const payload = encodePayload({ action: "registration-success" });
    node.lightPush.send(encoder, { payload });
    return;
  }

  // Check if the public key is registered
  if (!isRegistered(publicKey)) {
    console.debug("key not registered");
    return;
  }

  // Check if the sender is the registered user
  const key = getKey(publicKey);
  if (
    !key ||
    !equals(message.signaturePublicKey, key?.publicKey ?? new Uint8Array())
  ) {
    console.debug("invalid signing key");
    return;
  }

  // Decode the message
  const json = decodePayload(message);

  if (json.action === "pin") {
    console.log("Pinning file");
    const cid = await unixfs.addFile({ content: fromHex(json.data) });

    // Reply with a success message
    const node = await getNode();
    const encoder = getEncoder(
      publicKey,
      message.signaturePublicKey,
      key.privateKey
    );
    const payload = encodePayload({
      action: "upload-success",
      cid: cid.toString(),
    });
    node.lightPush.send(encoder, { payload });
  }
};

export const subscribeToKey = async (privateKey: Uint8Array) => {
  const publicKey = getPublicKey(privateKey);
  const decoder = createDecoder(getTopic(publicKey), privateKey);
  const subscription = await getSubscription();

  console.log(`Listening to ${getTopic(publicKey)}`);
  await subscription.subscribe([decoder], callback.bind(null, publicKey));
};

export const unsubscribeFromKey = async (publicKey: Uint8Array) => {
  console.log(`Unsubscribing from ${getTopic(publicKey)}`);
  const subscription = await getSubscription();
  subscription.unsubscribe([getTopic(publicKey)]);
};
