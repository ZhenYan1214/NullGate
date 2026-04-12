import { NextResponse } from "next/server";
import { merkleProofFor } from "@/lib/semaphore/group";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const commitment = searchParams.get("commitment");
  if (!commitment) {
    return NextResponse.json({ error: "missing commitment" }, { status: 400 });
  }
  try {
    const proof = await merkleProofFor(commitment);
    return NextResponse.json(proof);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
