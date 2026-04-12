/**
 * Day 0 sanity check #2: verify HashKey Chain testnet (133) actually supports the
 * bn254 precompiles Semaphore needs — specifically:
 *   - 0x06 ecAdd      (EIP-196)
 *   - 0x07 ecMul      (EIP-196)
 *   - 0x08 ecPairing  (EIP-197)
 *
 * HashKey Chain is OP-Stack L2 so this *should* work, but we check rather than
 * assume. Uses raw eth_call — no wallet funding required.
 *
 * Strategy:
 *   - ecAdd(0,0,0,0) → must return 0 (identity)
 *   - ecPairing with empty input → must return 1 (32 bytes of 0x00..01)
 *   - ecMul(0,0,0) → must return 0 (identity)
 *
 * If all three return the expected value we have pairing-friendly bn254 and
 * Semaphore's stock verifier will work. If any revert, fall back to Sepolia.
 */
import { createPublicClient, http } from "viem";

const RPCS = {
  "hashkey-testnet": "https://testnet.hsk.xyz",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
};

const ZERO64 = "0x" + "00".repeat(64);   // 2 × 32 bytes
const ZERO96 = "0x" + "00".repeat(96);   // 3 × 32 bytes
const ZERO128 = "0x" + "00".repeat(128); // ecAdd input (4 × 32)

async function probe(name: string, url: string) {
  console.log(`\n[chain-check] === ${name} (${url}) ===`);
  const client = createPublicClient({ transport: http(url) });

  try {
    const chainId = await client.getChainId();
    console.log(`[chain-check] chainId: ${chainId}`);
  } catch (e) {
    console.error(`[chain-check] cannot reach RPC: ${(e as Error).message}`);
    return { ok: false, reason: "rpc-unreachable" };
  }

  async function call(label: string, to: `0x${string}`, data: `0x${string}`, expected: string) {
    try {
      const result = await client.call({ to, data });
      const got = result.data ?? "0x";
      const ok = got.toLowerCase() === expected.toLowerCase();
      console.log(`[chain-check] ${label}: ${ok ? "OK" : "MISMATCH"} (got=${got})`);
      return ok;
    } catch (e) {
      console.error(`[chain-check] ${label}: REVERT (${(e as Error).message.slice(0, 100)})`);
      return false;
    }
  }

  const expected0 = "0x" + "00".repeat(64); // 2 × 32 zero bytes
  const expected1 = "0x" + "00".repeat(31) + "01"; // single 32-byte word == 1

  const ecAddOK = await call(
    "ecAdd(0,0,0,0)",
    "0x0000000000000000000000000000000000000006",
    ZERO128 as `0x${string}`,
    expected0
  );
  const ecMulOK = await call(
    "ecMul(0,0,0)",
    "0x0000000000000000000000000000000000000007",
    ZERO96 as `0x${string}`,
    expected0
  );
  const ecPairingOK = await call(
    "ecPairing(empty)",
    "0x0000000000000000000000000000000000000008",
    "0x",
    expected1
  );

  const allOk = ecAddOK && ecMulOK && ecPairingOK;
  console.log(`[chain-check] VERDICT: ${allOk ? "bn254 precompiles WORKING" : "bn254 precompile MISSING"}`);
  return { ok: allOk };
}

async function main() {
  const target = process.argv[2] ?? "hashkey-testnet";
  const url = (RPCS as Record<string, string>)[target];
  if (!url) {
    console.error("unknown target; pick one of:", Object.keys(RPCS).join(", "));
    process.exit(2);
  }
  const result = await probe(target, url);
  if (!result.ok) {
    console.error("\n[chain-check] FAIL — this chain is NOT safe for Semaphore.");
    console.error("                Try: npx tsx scripts/day0-chain-check.ts sepolia");
    process.exit(1);
  }
  console.log("\n[chain-check] PASS — safe to deploy Semaphore verifier here.");
}

main();
