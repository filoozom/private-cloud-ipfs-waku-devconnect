import {
  LightNode,
  Protocols,
  createLightNode,
  waitForRemotePeer,
} from "@waku/sdk";
import { bootstrap } from "@libp2p/bootstrap";

// Singleton
export let node: LightNode | undefined;

// Nodes
const nodes = [
  "/dns4/ws.waku.apyos.dev/tcp/8123/wss/p2p/16Uiu2HAkzy7Apy2H72WYx3cSdPFqmeLThHTi8EY2KN22rpKHZ4gM",
];

export const getNode = async () => {
  if (!node) {
    node = await createLightNode({
      libp2p: {
        peerDiscovery: [bootstrap({ list: nodes })],
      },
    });

    await node.start();
    await waitForRemotePeer(node, [Protocols.LightPush]);
  }

  return node;
};
