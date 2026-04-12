/**
 * Issuer-side group store. The full allowlist lives here as a JSON file — only the
 * Merkle root ever hits chain. All mutations go through this module so the on-disk
 * file and the in-memory Group stay consistent.
 *
 * Runs on the Next.js Node runtime only (reads/writes the filesystem).
 */
import "server-only";
import { Group } from "@semaphore-protocol/group";
import fs from "node:fs/promises";
import path from "node:path";

const GROUP_FILE = path.join(process.cwd(), "data", "group.json");

type GroupFile = {
  members: string[]; // identity commitments as decimal strings
  publishedRoot: string | null; // last root published on-chain, for UI display
};

async function readFile(): Promise<GroupFile> {
  try {
    const raw = await fs.readFile(GROUP_FILE, "utf8");
    return JSON.parse(raw) as GroupFile;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { members: [], publishedRoot: null };
    }
    throw e;
  }
}

async function writeFile(file: GroupFile): Promise<void> {
  await fs.mkdir(path.dirname(GROUP_FILE), { recursive: true });
  await fs.writeFile(GROUP_FILE, JSON.stringify(file, null, 2));
}

function toGroup(members: string[]): Group {
  const g = new Group();
  for (const m of members) g.addMember(BigInt(m));
  return g;
}

export async function getGroupState() {
  const file = await readFile();
  const group = toGroup(file.members);
  return {
    members: file.members,
    size: group.size,
    root: group.size === 0 ? null : group.root.toString(),
    publishedRoot: file.publishedRoot,
  };
}

export async function addMember(commitment: string): Promise<{ root: string; size: number }> {
  const file = await readFile();
  if (file.members.includes(commitment)) {
    throw new Error("member already in group");
  }
  file.members.push(commitment);
  await writeFile(file);
  const group = toGroup(file.members);
  return { root: group.root.toString(), size: group.size };
}

export async function markRootPublished(root: string): Promise<void> {
  const file = await readFile();
  file.publishedRoot = root;
  await writeFile(file);
}

/**
 * Build a Merkle proof for a single member — needed when the holder's browser
 * generates a Semaphore proof, since `generateProof` can accept either a full
 * Group or just a MerkleProof (which is much smaller to ship over the wire).
 */
export async function merkleProofFor(commitment: string) {
  const file = await readFile();
  const group = toGroup(file.members);
  const index = file.members.indexOf(commitment);
  if (index === -1) throw new Error("commitment not in group");
  const proof = group.generateMerkleProof(index);
  return {
    index,
    root: proof.root.toString(),
    siblings: proof.siblings.map((s) => s.toString()),
    leaf: proof.leaf.toString(),
  };
}
