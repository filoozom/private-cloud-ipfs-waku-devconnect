import fastify from "fastify";
import { Key, generateTempKey, keys, toHex } from "./shared.js";
import { getNode } from "./node.js";
import cors from "@fastify/cors";
import { getPublicKey } from "@waku/message-encryption";

const server = fastify();

server.register(cors);

server.get("/pairing", async () => {
  return { publicKey: generateTempKey() };
});

server.get("/registered", async () => {
  return Object.values(keys as Record<string, Key>).map((key) => ({
    remotePublicKey: toHex(key.publicKey),
    localPublicKey: toHex(getPublicKey(key.privateKey)),
    metadata: key.metadata,
  }));
});

await getNode();

try {
  const address = await server.listen({ port: 8080 });
  console.log(`Server listening at ${address}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
