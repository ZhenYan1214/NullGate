"use client";
import { useEffect, useState } from "react";
import { loadIdentity } from "@/lib/semaphore/identity";
import { generateAdmissionProof } from "@/lib/semaphore/proof";
import { connectWallet, walletClient, publicClient } from "@/lib/chain/browserClient";
import { COMPLIANCE_GATE_ABI } from "@/lib/chain/abi";
import { COMPLIANCE_GATE_ADDRESS, PRIVATE_RWA_ADDRESS } from "@/lib/chain/config";
import type { Address } from "viem";

type Phase = "idle" | "connecting" | "fetching-proof" | "proving" | "submitting" | "done" | "error";

const PHASE_LABELS = [
  { id: "wallet", label: "Wallet" },
  { id: "path", label: "Merkle path" },
  { id: "prove", label: "ZK proof" },
  { id: "tx", label: "On-chain" },
] as const;

function phaseStepClass(
  phase: Phase,
  stepIndex: number,
  connected: boolean
): string {
  const base = "phase-step";
  if (phase === "error") return base;

  const current =
    (stepIndex === 0 && phase === "connecting") ||
    (stepIndex === 1 && phase === "fetching-proof") ||
    (stepIndex === 2 && phase === "proving") ||
    (stepIndex === 3 && phase === "submitting");

  const done =
    (stepIndex === 0 && connected && phase !== "connecting") ||
    (stepIndex === 1 && (phase === "proving" || phase === "submitting" || phase === "done")) ||
    (stepIndex === 2 && (phase === "submitting" || phase === "done")) ||
    (stepIndex === 3 && phase === "done");

  if (current) return `${base} phase-step--current`;
  if (done) return `${base} phase-step--done`;
  return base;
}

export default function AdmitPage() {
  const [address, setAddress] = useState<Address | null>(null);
  const [token, setToken] = useState<string>(PRIVATE_RWA_ADDRESS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(false);

  useEffect(() => {
    setHasIdentity(!!loadIdentity());
  }, []);

  function append(line: string) {
    setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);
  }

  async function onConnect() {
    try {
      setPhase("connecting");
      const { address } = await connectWallet();
      setAddress(address);
      setPhase("idle");
      append(`connected ${address}`);
    } catch (e) {
      setErr((e as Error).message);
      setPhase("error");
    }
  }

  async function onAdmit() {
    setErr(null);
    setLog([]);
    const id = loadIdentity();
    if (!id) {
      setErr("No identity found. Create one at /join first.");
      setPhase("error");
      return;
    }
    if (!address) {
      setErr("Connect wallet first.");
      setPhase("error");
      return;
    }
    if (!token) {
      setErr("Token address required.");
      setPhase("error");
      return;
    }

    try {
      setPhase("fetching-proof");
      append("fetching Merkle path from issuer…");
      const r = await fetch(
        `/api/group/merkle-path?commitment=${encodeURIComponent(id.commitment.toString())}`
      );
      const mp = await r.json();
      if (!r.ok) throw new Error(mp.error ?? "merkle path fetch failed");
      append(`got path (index=${mp.index}, depth=${mp.siblings.length})`);

      setPhase("proving");
      append("generating ZK proof in wasm — this takes a few seconds");
      const t0 = Date.now();
      const proof = await generateAdmissionProof(id, mp, address, token as Address);
      append(`proof generated in ${Date.now() - t0}ms (depth=${proof.depth})`);

      setPhase("submitting");
      append("submitting admit() tx");
      const wallet = walletClient();
      const hash = await wallet.writeContract({
        account: address,
        address: COMPLIANCE_GATE_ADDRESS,
        abi: COMPLIANCE_GATE_ABI,
        functionName: "admit",
        args: [
          token as Address,
          BigInt(proof.root),
          BigInt(proof.depth),
          BigInt(proof.nullifier),
          proof.points.map((p) => BigInt(p)) as unknown as readonly [
            bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint
          ],
        ],
      });
      append(`tx sent ${hash}`);
      const receipt = await publicClient().waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        // The revert reason isn't always decodable from the receipt on HashKey testnet,
        // so surface a helpful message based on the most likely causes.
        append("ERROR: transaction reverted on-chain.");
        setErr(
          "Transaction reverted. Possible reasons: KYC not approved (ask issuer to approve your address), " +
          "nullifier already used (this identity already admitted this wallet), or root not published."
        );
        setPhase("error");
        return;
      }
      append("confirmed. you are now admitted to this token.");
      setPhase("done");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("NotKYCVerified")) {
        setErr("KYC verification failed — your wallet does not have a HashKey KYC SBT. Ask the issuer to approve your address first.");
      } else if (msg.includes("NullifierReused")) {
        setErr("Already admitted — this identity has already been used to admit this wallet.");
      } else {
        setErr(msg);
      }
      setPhase("error");
    }
  }

  const busy = phase === "fetching-proof" || phase === "proving" || phase === "submitting";
  const admitDisabled = busy || !address || !hasIdentity || phase === "done";

  const buttonLabel =
    phase === "idle"
      ? "Generate proof & admit"
      : phase === "fetching-proof"
        ? "Fetching path…"
        : phase === "proving"
          ? "Proving in wasm…"
          : phase === "submitting"
            ? "Submitting tx…"
            : phase === "done"
              ? "Admitted ✓"
              : phase === "error"
                ? "Retry"
                : "Generate proof & admit";

  return (
    <div>
      <header className="page-header">
        <p className="page-header__eyebrow">Holder · Step 2</p>
        <h1>Self-admit to a token</h1>
        <p className="page-header__desc">
          Prove in your browser that you&apos;re in the issuer&apos;s allowlist — the contract will
          record your address as admitted without ever learning which group member you are.
        </p>
      </header>

      <ul className="phase-steps" aria-label="Admission progress">
        {PHASE_LABELS.map((s, i) => (
          <li key={s.id} className={phaseStepClass(phase, i, !!address)}>
            <span aria-hidden>{i + 1}</span>
            {s.label}
          </li>
        ))}
      </ul>

      <div className="card">
        <div className="row">
          <label htmlFor="wallet-addr">Wallet</label>
          <div id="wallet-addr" className="mono">
            {address ?? "(not connected)"}
          </div>
        </div>
        {!address && (
          <button type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <label>Identity</label>
          <div className="mono">
            {hasIdentity ? "loaded from localStorage ✓" : "none — create one at /join"}
          </div>
        </div>

        <label className="field-label" htmlFor="token-addr" style={{ marginTop: 8 }}>
          Token contract
        </label>
        <input id="token-addr" value={token} onChange={(e) => setToken(e.target.value)} />

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button type="button" onClick={onAdmit} disabled={admitDisabled}>
            {buttonLabel}
          </button>
        </div>

        {err && <div className="err">{err}</div>}
      </div>

      <div className="card">
        <h2>Progress</h2>
        <pre className="log">{log.length === 0 ? "(waiting)" : log.join("\n")}</pre>
      </div>
    </div>
  );
}
