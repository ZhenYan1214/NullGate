/**
 * Minimal browser wallet + public client helpers. We deliberately avoid wagmi/
 * RainbowKit to stay inside the 3.5-day solo budget — a direct viem + window.ethereum
 * connect flow is enough for the demo.
 */
"use client";
import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { hashkeyTestnet, CHAIN_ID, RPC_URL } from "./config";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function publicClient() {
  return createPublicClient({ chain: hashkeyTestnet, transport: http(RPC_URL) });
}

export async function connectWallet(): Promise<{ address: Address }> {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Install MetaMask or another EIP-1193 wallet.");
  }
  const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts.length) throw new Error("No account authorised");
  const hexChainId = `0x${CHAIN_ID.toString(16)}` as const;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (e: any) {
    if (e?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: hashkeyTestnet.name,
            nativeCurrency: hashkeyTestnet.nativeCurrency,
            rpcUrls: hashkeyTestnet.rpcUrls.default.http,
            blockExplorerUrls: [hashkeyTestnet.blockExplorers.default.url],
          },
        ],
      });
    }
  }
  return { address: accounts[0] as Address };
}

export function walletClient() {
  if (!window.ethereum) throw new Error("no wallet");
  return createWalletClient({ chain: hashkeyTestnet, transport: custom(window.ethereum) });
}
