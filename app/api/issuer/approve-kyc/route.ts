import { NextResponse } from "next/server";
import { issuerWallet } from "@/lib/chain/issuerClient";
import { MOCK_KYC_SBT_ADDRESS } from "@/lib/chain/config";
import { MOCK_KYC_SBT_ABI } from "@/lib/chain/abi";

export const runtime = "nodejs";

/**
 * Approve or revoke a wallet address in MockKycSBT.
 * Body: { address: string, approved: boolean }
 *
 * DEMO ONLY — this endpoint exists so the issuer dashboard can simulate
 * HashKey KYC approval without going through real KYC verification.
 * In production this endpoint would not exist; KYC is granted by HashKey.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { address?: string; approved?: boolean };
  if (!body.address || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "missing 'address' or 'approved'" }, { status: 400 });
  }

  const { wallet, publicClient, account } = issuerWallet();
  try {
    const hash = await wallet.writeContract({
      address: MOCK_KYC_SBT_ADDRESS,
      abi: MOCK_KYC_SBT_ABI,
      functionName: body.approved ? "approve" : "revoke",
      args: [body.address as `0x${string}`],
      account,
      chain: wallet.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ txHash: hash, address: body.address, approved: body.approved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
