import { NextResponse } from "next/server";
import { isAddress, parseUnits } from "viem";
import { issuerWallet, PRIVATE_RWA_ABI } from "@/lib/chain/issuerClient";
import { PRIVATE_RWA_ADDRESS } from "@/lib/chain/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { to?: string; amount?: string };
  if (!body.to || !body.amount) {
    return NextResponse.json({ error: "missing to or amount" }, { status: 400 });
  }
  if (!isAddress(body.to)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const { wallet, publicClient, account } = issuerWallet();
  try {
    const hash = await wallet.writeContract({
      address: PRIVATE_RWA_ADDRESS,
      abi: PRIVATE_RWA_ABI,
      functionName: "mint",
      args: [body.to as `0x${string}`, parseUnits(body.amount, 18)],
      account,
      chain: wallet.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ txHash: hash });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
