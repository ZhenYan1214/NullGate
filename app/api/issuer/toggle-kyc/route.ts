import { NextResponse } from "next/server";
import { issuerWallet, COMPLIANCE_GATE_ABI } from "@/lib/chain/issuerClient";
import { COMPLIANCE_GATE_ADDRESS } from "@/lib/chain/config";

export const runtime = "nodejs";

/**
 * Enable or disable HashKey KYC verification in ComplianceGate.
 * Body: { enabled: boolean }
 *
 * When enabled=true, admit() will call kycSbt.isHuman(msg.sender) and revert
 * with NotKYCVerified if the caller has no valid KYC SBT.
 * When enabled=false (default), only the ZK proof is required — demo mode.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "missing or invalid 'enabled' boolean" }, { status: 400 });
  }

  const { wallet, publicClient, account } = issuerWallet();
  try {
    const hash = await wallet.writeContract({
      address: COMPLIANCE_GATE_ADDRESS,
      abi: COMPLIANCE_GATE_ABI,
      functionName: "setKycEnabled",
      args: [body.enabled],
      account,
      chain: wallet.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ txHash: hash, kycEnabled: body.enabled });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
