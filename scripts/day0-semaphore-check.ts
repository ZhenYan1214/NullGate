/**
 * Day 0 sanity check: exercise the Semaphore v4 API end-to-end (identity → group →
 * proof → local verify) to (1) lock down the JS API shape we'll depend on, and
 * (2) measure wall-clock proof generation time on this machine. No chain calls here
 * — the HashKey chain 133 pairing check is a separate script.
 */
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";

async function main() {
  console.log("[day0] creating 3 identities + group");
  const alice = new Identity();
  const bob = new Identity();
  const carol = new Identity();

  const group = new Group();
  group.addMember(alice.commitment);
  group.addMember(bob.commitment);
  group.addMember(carol.commitment);

  console.log("[day0] group size:", group.size, "root:", group.root.toString());

  // Mirror what the real contract will do: message = holder addr as uint, scope = token addr as uint.
  const holderAddr = "0x000000000000000000000000000000000000beef";
  const tokenAddr = "0x00000000000000000000000000000000000dead1";
  const message = BigInt(holderAddr);
  const scope = BigInt(tokenAddr);

  console.log("[day0] generating proof — wasm warmup takes ~8s first time");
  const t0 = Date.now();
  const proof = await generateProof(alice, group, message, scope);
  const dt = Date.now() - t0;
  console.log(`[day0] proof generated in ${dt}ms (depth=${proof.merkleTreeDepth})`);

  console.log("[day0] verifying proof locally");
  const valid = await verifyProof(proof);
  console.log("[day0] valid:", valid);

  if (!valid) {
    console.error("[day0] FAIL: proof did not verify");
    process.exit(1);
  }

  console.log("[day0] proof points (8):");
  proof.points.forEach((p, i) => console.log(`  [${i}] ${p}`));
  console.log("[day0] merkleTreeRoot:", proof.merkleTreeRoot);
  console.log("[day0] nullifier:    ", proof.nullifier);
  console.log("[day0] message:      ", proof.message, "(_hashed inside circuit)");
  console.log("[day0] scope:        ", proof.scope, "(_hashed inside circuit)");

  // Dump a fixture for a future on-chain integration test.
  const fs = await import("node:fs/promises");
  await fs.mkdir("scripts/out", { recursive: true });
  await fs.writeFile(
    "scripts/out/day0-fixture.json",
    JSON.stringify(
      {
        holderAddr,
        tokenAddr,
        proof,
        generationMs: dt,
        groupRoot: group.root.toString(),
      },
      null,
      2
    )
  );
  console.log("[day0] fixture written to scripts/out/day0-fixture.json");
}

main().catch((e) => {
  console.error("[day0] error:", e);
  process.exit(1);
});
