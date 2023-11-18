import { createHelia } from "helia";
import { unixfs as createUnixfs } from "@helia/unixfs";
import { FsBlockstore } from "blockstore-fs";

try {
  const blockstore = new FsBlockstore("ipfs-store");
  const helia = await createHelia({ blockstore });
  const unixfs = createUnixfs(helia);
} catch (err) {
  console.error(err);
}

const blockstore = new FsBlockstore("ipfs-store");
export const helia = await createHelia({ blockstore });
export const unixfs = createUnixfs(helia);
