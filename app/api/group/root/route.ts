import { NextResponse } from "next/server";
import { getGroupState } from "@/lib/semaphore/group";

export const runtime = "nodejs";

export async function GET() {
  const state = await getGroupState();
  return NextResponse.json(state);
}
