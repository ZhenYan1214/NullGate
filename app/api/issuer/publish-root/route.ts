import { NextResponse } from "next/server";
import { getGroupState, markRootPublished } from "@/lib/semaphore/group";
import { issuerWallet, COMPLIANCE_GATE_ABI } from "@/lib/chain/issuerClient";
import { COMPLIANCE_GATE_ADDRESS } from "@/lib/chain/config";

export const runtime = "nodejs";

/**
 * Publishes the current off-chain Merkle root to ComplianceGate.updateRoot.
 * Signed by the issuer wallet loaded from ISSUER_PRIVATE_KEY.
 */
export async function POST() {
  const state = await getGroupState();
  if (!state.root) {
    return NextResponse.json({ error: "group is empty" }, { status: 400 });
  }
  const { wallet, publicClient, account } = issuerWallet();
  try {
    const hash = await wallet.writeContract({
      address: COMPLIANCE_GATE_ADDRESS,
      abi: COMPLIANCE_GATE_ABI,
      functionName: "updateRoot",
      args: [BigInt(state.root)],
      account,
      chain: wallet.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await markRootPublished(state.root);
    return NextResponse.json({ txHash: hash, root: state.root });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
