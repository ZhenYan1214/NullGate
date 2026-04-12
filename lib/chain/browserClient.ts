/**
 * Minimal browser wallet + public client helpers. We deliberately avoid wagmi/
 * RainbowKit to stay inside the 3.5-day solo budget — a direct viem + window.ethereum
 * connect flow is enough for the demo.
 */
"use client";
import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { hashkeyTestnet, RPC_URL } from "./config";

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
  // Prompt user to switch/add HashKey testnet if not on it already.
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x85" }],
    });
  } catch (e: any) {
    if (e?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x85",
            chainName: "HashKey Chain Testnet",
            nativeCurrency: { name: "HashKey", symbol: "HSK", decimals: 18 },
            rpcUrls: ["https://testnet.hsk.xyz"],
            blockExplorerUrls: ["https://hashkeychain-testnet-explorer.alt.technology"],
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
