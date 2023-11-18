import fastify from "fastify";
import { generateTempKey } from "./shared.js";
import { getNode } from "./node.js";
import cors from "@fastify/cors";

const server = fastify();

server.register(cors);

server.get("/pairing", async () => {
  return { publicKey: generateTempKey() };
});

await getNode();

try {
  const address = await server.listen({ port: 8080 });
  console.log(`Server listening at ${address}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
