import fastify from "fastify";
import { Key, generateTempKey, keys, toHex } from "./shared.js";
import { getNode } from "./node.js";
import cors from "@fastify/cors";
import { getPublicKey } from "@waku/message-encryption";

const server = fastify({ maxParamLength: 200 });

server.register(cors);

server.get("/pairing", async () => {
  return { publicKey: generateTempKey() };
});

server.get("/registration", async () => {
  return Object.values(keys as Record<string, Key>).map((key) => ({
    remotePublicKey: toHex(key.publicKey),
    localPublicKey: toHex(getPublicKey(key.privateKey)),
    metadata: key.metadata,
  }));
});

server.delete("/registration/:publicKey", async ({ params }) => {
  // @ts-expect-error TODO: Set up TS / schemas
  delete keys[params.publicKey];
  return { success: true };
});

await getNode();

try {
  const address = await server.listen({ port: 8080 });
  console.log(`Server listening at ${address}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
