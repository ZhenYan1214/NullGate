import { NextResponse } from "next/server";
import { seedFromLocal, getGroupState } from "@/lib/semaphore/group";

export const runtime = "nodejs";

export async function POST() {
  try {
    await seedFromLocal();
    const state = await getGroupState();
    return NextResponse.json({ ok: true, size: state.size, root: state.root });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
