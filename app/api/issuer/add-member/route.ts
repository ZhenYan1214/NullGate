import { NextResponse } from "next/server";
import { addMember } from "@/lib/semaphore/group";

export const runtime = "nodejs";

/**
 * Issuer appends a new holder's identity commitment to the off-chain group.
 * In the demo the issuer just trusts the caller — production would gate this
 * behind KYC + a signed API token. See plan: "No real KYC integration".
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { commitment?: string };
  if (!body.commitment) {
    return NextResponse.json({ error: "missing commitment" }, { status: 400 });
  }
  try {
    const result = await addMember(body.commitment);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
