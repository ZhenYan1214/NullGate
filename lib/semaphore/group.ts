/**
 * Issuer-side group store. The full allowlist lives here — only the Merkle root
 * ever hits chain.
 *
 * Storage backend:
 *   - If UPSTASH_REDIS_REST_URL is set → Upstash Redis (Vercel production)
 *   - Otherwise → local data/group.json (local dev)
 *
 * All mutations go through this module so the backing store and the in-memory
 * Semaphore Group stay consistent.
 */
import "server-only";
import { Group } from "@semaphore-protocol/group";

type GroupFile = {
  members: string[];
  publishedRoot: string | null;
};

const REDIS_KEY = "zk-rwa:group";

// ── Storage backend abstraction ──────────────────────────────────────────

async function readStore(): Promise<GroupFile> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return readRedis();
  }
  return readLocalFile();
}

async function writeStore(data: GroupFile): Promise<void> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return writeRedis(data);
  }
  return writeLocalFile(data);
}

// ── Upstash Redis backend ────────────────────────────────────────────────

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function readRedis(): Promise<GroupFile> {
  const redis = await getRedis();
  const data = await redis.get<GroupFile>(REDIS_KEY);
  return data ?? { members: [], publishedRoot: null };
}

async function writeRedis(data: GroupFile): Promise<void> {
  const redis = await getRedis();
  await redis.set(REDIS_KEY, data);
}

// ── Local filesystem backend (dev only) ──────────────────────────────────

async function readLocalFile(): Promise<GroupFile> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "data", "group.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as GroupFile;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { members: [], publishedRoot: null };
    }
    throw e;
  }
}

async function writeLocalFile(data: GroupFile): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "data", "group.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ── Semaphore group helpers ──────────────────────────────────────────────

function toGroup(members: string[]): Group {
  const g = new Group();
  for (const m of members) g.addMember(BigInt(m));
  return g;
}

// ── Public API (unchanged interface) ─────────────────────────────────────

export async function getGroupState() {
  const file = await readStore();
  const group = toGroup(file.members);
  return {
    members: file.members,
    size: group.size,
    root: group.size === 0 ? null : group.root.toString(),
    publishedRoot: file.publishedRoot,
  };
}

export async function addMember(commitment: string): Promise<{ root: string; size: number }> {
  const file = await readStore();
  if (file.members.includes(commitment)) {
    throw new Error("member already in group");
  }
  file.members.push(commitment);
  await writeStore(file);
  const group = toGroup(file.members);
  return { root: group.root.toString(), size: group.size };
}

export async function markRootPublished(root: string): Promise<void> {
  const file = await readStore();
  file.publishedRoot = root;
  await writeStore(file);
}

export async function merkleProofFor(commitment: string) {
  const file = await readStore();
  const group = toGroup(file.members);
  const leafIndex = file.members.indexOf(commitment);
  if (leafIndex === -1) throw new Error("commitment not in group");
  const proof = group.generateMerkleProof(leafIndex);
  // proof.index is the LeanIMT path index (bit-encoded left/right turns),
  // which differs from the leaf's array position when some sibling slots are
  // absent (e.g. the last leaf in an odd-sized tree). The ZK circuit uses
  // this path index to reconstruct the Merkle root — passing the raw array
  // position produces an incorrect root and an InvalidProof revert.
  return {
    index: proof.index,
    root: proof.root.toString(),
    siblings: proof.siblings.map((s) => s.toString()),
    leaf: proof.leaf.toString(),
  };
}

/**
 * Seed Redis with data from local group.json. Call once after first Vercel deploy
 * via: POST /api/issuer/seed-redis
 */
export async function seedFromLocal(): Promise<void> {
  const local = await readLocalFile();
  if (local.members.length === 0) return;
  await writeRedis(local);
}
