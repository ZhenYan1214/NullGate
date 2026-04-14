/**
 * Browser proof generation. This module intentionally does not import server
 * code and must only run inside a client component — snarkjs uses wasm + workers
 * that break in Next.js edge/SSR contexts.
 */
"use client";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import type { MerkleProof } from "@semaphore-protocol/group";

export type AdmissionProof = {
  root: string;
  depth: number;
  nullifier: string;
  points: readonly string[]; // length 8
};

/**
 * Generate a Semaphore proof that msg.sender (holder) is in the group, binding
 * the proof to (holder, token). Scope = token address, so the same identity can
 * admit to different tokens without sharing a nullifier.
 */
export async function generateAdmissionProof(
  identity: Identity,
  merkleProofInput: {
    index: number;
    root: string;
    siblings: string[];
    leaf: string;
  },
  holderAddress: `0x${string}`,
  tokenAddress: `0x${string}`
): Promise<AdmissionProof> {
  const merkleProof: MerkleProof = {
    index: merkleProofInput.index,
    root: BigInt(merkleProofInput.root),
    leaf: BigInt(merkleProofInput.leaf),
    siblings: merkleProofInput.siblings.map((s) => BigInt(s)),
  };

  const message = BigInt(holderAddress);
  const scope = BigInt(tokenAddress);

  // Force depth-20 artifacts — the PSE CDN reliably hosts depth-20 circuits.
  // The Semaphore circuit is variable-depth: it receives the *actual* siblings
  // via merkleProofLength, so a depth-1 tree (2 members) still produces the
  // correct root. Without this override, small groups (depth < ~8) can trigger
  // an "Assert Failed in Num2Bits" because the CDN may not host those artifacts.
  const proof = await generateProof(identity, merkleProof, message, scope, 20);

  return {
    root: proof.merkleTreeRoot.toString(),
    depth: proof.merkleTreeDepth,
    nullifier: proof.nullifier.toString(),
    points: proof.points.map((p) => p.toString()) as readonly string[],
  };
}
