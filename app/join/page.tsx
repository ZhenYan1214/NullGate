"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadIdentity, createIdentity, clearIdentity } from "@/lib/semaphore/identity";

export default function JoinPage() {
  const [commitment, setCommitment] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = loadIdentity();
    if (id) setCommitment(id.commitment.toString());
  }, []);

  function onCreate() {
    const id = createIdentity();
    setCommitment(id.commitment.toString());
    setCopied(false);
  }

  function onReset() {
    clearIdentity();
    setCommitment(null);
  }

  async function onCopy() {
    if (!commitment) return;
    await navigator.clipboard.writeText(commitment);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <header className="page-header">
        <p className="page-header__eyebrow">Holder · Step 1</p>
        <h1>Create your holder identity</h1>
        <p className="page-header__desc">
          Your Semaphore identity is generated and stored locally in your browser. The issuer
          will add your <em>identity commitment</em> — a one-way hash — to their private allowlist.
          Your underlying keys never leave this device.
        </p>
      </header>

      <div className="card">
        {!commitment ? (
          <>
            <p className="empty-state">No identity on this device yet. Generate one to receive a commitment you can share with the issuer.</p>
            <button type="button" onClick={onCreate}>
              Create identity
            </button>
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="commitment-display">
              Identity commitment
            </label>
            <div id="commitment-display" className="mono" style={{ padding: "14px 16px", background: "var(--bg-sunken)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              {commitment}
            </div>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <button type="button" onClick={onCopy}>
                {copied ? "Copied ✓" : "Copy commitment"}
              </button>
              <button type="button" className="secondary" onClick={onReset}>
                Reset identity
              </button>
            </div>
            <div className="hint">
              Hand this commitment to the issuer. They&apos;ll add it in the dashboard and
              publish a new Merkle root. When the root is on-chain, continue to{" "}
              <Link href="/admit">Admit</Link> to prove membership and link your wallet.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
