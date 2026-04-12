/**
 * Single source of truth for chain config. Reads env vars once at module load so
 * we don't have drift between server and client. HashKey Chain testnet is the primary
 * target; Sepolia is the documented fallback if bn254 pairing precompiles misbehave.
 */
import { defineChain } from "viem";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HashKey", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
    public: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Testnet Explorer", url: "https://hashkeychain-testnet-explorer.alt.technology" },
  },
  testnet: true,
});

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 133);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet.hsk.xyz";

export const COMPLIANCE_GATE_ADDRESS = (process.env.NEXT_PUBLIC_COMPLIANCE_GATE_ADDRESS ?? "0x") as `0x${string}`;
export const PRIVATE_RWA_ADDRESS = (process.env.NEXT_PUBLIC_PRIVATE_RWA_ADDRESS ?? "0x") as `0x${string}`;
export const ISSUER_ADDRESS = (process.env.NEXT_PUBLIC_ISSUER_ADDRESS ?? "0x") as `0x${string}`;
