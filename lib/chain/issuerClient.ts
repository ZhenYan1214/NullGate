/**
 * Server-side viem client used by issuer-only API routes (publishRoot, mint).
 * Signs with ISSUER_PRIVATE_KEY from env. Never import this from client code.
 */
import "server-only";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hashkeyTestnet } from "./config";
import { COMPLIANCE_GATE_ABI, PRIVATE_RWA_ABI } from "./abi";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

export function issuerWallet() {
  const pk = requiredEnv("ISSUER_PRIVATE_KEY") as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({
    account,
    chain: hashkeyTestnet,
    transport: http(process.env.HASHKEY_TESTNET_RPC ?? hashkeyTestnet.rpcUrls.default.http[0]),
  });
  const publicClient = createPublicClient({
    chain: hashkeyTestnet,
    transport: http(process.env.HASHKEY_TESTNET_RPC ?? hashkeyTestnet.rpcUrls.default.http[0]),
  });
  return { wallet, publicClient, account };
}

export { COMPLIANCE_GATE_ABI, PRIVATE_RWA_ABI };
