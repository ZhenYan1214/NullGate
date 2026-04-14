"use client";
import { useEffect, useState } from "react";
import { PRIVATE_RWA_ADDRESS, COMPLIANCE_GATE_ADDRESS, MOCK_KYC_SBT_ADDRESS } from "@/lib/chain/config";
import { publicClient } from "@/lib/chain/browserClient";
import { COMPLIANCE_GATE_ABI, PRIVATE_RWA_ABI, MOCK_KYC_SBT_ABI } from "@/lib/chain/abi";

type GroupState = {
  members: string[];
  size: number;
  root: string | null;
  publishedRoot: string | null;
};

export default function IssuerPage() {
  const [state, setState] = useState<GroupState | null>(null);
  const [newCommitment, setNewCommitment] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("1000");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [onChainRoot, setOnChainRoot] = useState<string | null>(null);
  const [totalSupply, setTotalSupply] = useState<string | null>(null);
  const [kycEnabled, setKycEnabled] = useState<boolean>(false);
  const [kycAddress, setKycAddress] = useState("");
  const [kycAddressStatus, setKycAddressStatus] = useState<boolean | null>(null);

  function append(line: string) {
    setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);
  }

  async function refresh() {
    const r = await fetch("/api/group/root");
    if (!r.ok) return;
    setState(await r.json());
  }

  async function refreshChainStats() {
    try {
      const pc = publicClient();
      const [root, supply, kycOn] = await Promise.all([
        pc.readContract({
          address: COMPLIANCE_GATE_ADDRESS,
          abi: COMPLIANCE_GATE_ABI,
          functionName: "currentRoot",
        }),
        pc.readContract({
          address: PRIVATE_RWA_ADDRESS,
          abi: PRIVATE_RWA_ABI,
          functionName: "totalSupply",
        }),
        pc.readContract({
          address: COMPLIANCE_GATE_ADDRESS,
          abi: COMPLIANCE_GATE_ABI,
          functionName: "kycEnabled",
        }),
      ]);
      setOnChainRoot((root as bigint).toString());
      setTotalSupply((Number(supply as bigint) / 1e18).toLocaleString());
      setKycEnabled(kycOn as boolean);
    } catch {
      // Contracts not deployed yet — that's fine
    }
  }

  async function checkKycStatus(address: string) {
    if (!address.trim()) return;
    try {
      const pc = publicClient();
      const [isHuman] = await pc.readContract({
        address: MOCK_KYC_SBT_ADDRESS,
        abi: MOCK_KYC_SBT_ABI,
        functionName: "isHuman",
        args: [address.trim() as `0x${string}`],
      }) as [boolean, number];
      setKycAddressStatus(isHuman);
    } catch {
      setKycAddressStatus(null);
    }
  }

  async function toggleKyc() {
    setBusy(true);
    try {
      const r = await fetch("/api/issuer/toggle-kyc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !kycEnabled }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setKycEnabled(j.kycEnabled);
      append(`KYC verification ${j.kycEnabled ? "ENABLED" : "DISABLED"} — tx ${j.txHash.slice(0, 14)}…`);
    } catch (e) {
      append(`ERROR: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function setKycApproval(approved: boolean) {
    if (!kycAddress.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/issuer/approve-kyc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: kycAddress.trim(), approved }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      append(`${approved ? "Approved" : "Revoked"} KYC for ${kycAddress.slice(0, 10)}… — tx ${j.txHash.slice(0, 14)}…`);
      await checkKycStatus(kycAddress);
    } catch (e) {
      append(`ERROR: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  useEffect(() => {
    refresh();
    refreshChainStats();
  }, []);

  async function addMember() {
    if (!newCommitment.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/issuer/add-member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitment: newCommitment.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      append(`added member — new off-chain root ${j.root.slice(0, 12)}…`);
      setNewCommitment("");
      await refresh();
    } catch (e) {
      append(`ERROR: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function addBatch() {
    const commitments = batchInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!commitments.length) return;
    setBusy(true);
    let added = 0;
    for (const c of commitments) {
      try {
        const r = await fetch("/api/issuer/add-member", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ commitment: c }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        added++;
      } catch (e) {
        append(`batch skip: ${(e as Error).message}`);
      }
    }
    append(`batch complete: ${added}/${commitments.length} members added`);
    setBatchInput("");
    await refresh();
    setBusy(false);
  }

  async function publishRoot() {
    setBusy(true);
    try {
      const r = await fetch("/api/issuer/publish-root", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      append(`published root on-chain — tx ${j.txHash.slice(0, 14)}…`);
      await refresh();
      await refreshChainStats();
    } catch (e) {
      append(`ERROR: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function mint() {
    if (!mintTo.trim() || !mintAmount.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/issuer/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: mintTo.trim(), amount: mintAmount }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      append(`minted ${mintAmount} ZKCB to ${mintTo.slice(0, 10)}… — tx ${j.txHash.slice(0, 14)}…`);
      await refreshChainStats();
    } catch (e) {
      append(`ERROR: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  const stats = [
    { label: "Group size (private)", value: state?.size ?? "…", sub: "off-chain only" },
    {
      label: "On-chain root",
      value: onChainRoot ? onChainRoot.slice(0, 8) + "…" : "—",
      sub: "public",
    },
    {
      label: "Total supply",
      value: totalSupply ? `${totalSupply} ZKCB` : "—",
      sub: "public",
    },
    {
      label: "Root synced?",
      value:
        state?.root && state.publishedRoot && state.root === state.publishedRoot
          ? "Yes"
          : "No",
      sub: state?.root !== state?.publishedRoot ? "drift detected" : "in sync",
    },
  ];

  return (
    <div>
      <header className="page-header">
        <p className="page-header__eyebrow">Issuer console</p>
        <h1>Issuer dashboard</h1>
        <p className="page-header__desc">
          Manage the private allowlist, publish Merkle roots, and mint tokens to admitted
          holders. The full member list never leaves this backend.
        </p>
      </header>

      <div className="card card--accent">
        <h2>Compliance audit view</h2>
        <p className="card__sub">
          What a regulator or auditor can see — aggregate metrics without individual
          identity exposure. Compare this to ERC-3643 where the full registry is public.
        </p>
        <div className="stat-grid">
          {stats.map((item, i) => (
            <div key={i} className="stat-tile">
              <div className="stat-tile__label">{item.label}</div>
              <div className="stat-tile__value">{item.value}</div>
              <div className="stat-tile__sub">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Group state</h2>
        <p className="card__sub">Off-chain tree vs on-chain commitment.</p>
        <dl className="kv">
          <dt>Members</dt>
          <dd>{state?.size ?? "…"}</dd>
          <dt>Off-chain root</dt>
          <dd>{state?.root ?? "(empty)"}</dd>
          <dt>Published root</dt>
          <dd>{state?.publishedRoot ?? "(never published)"}</dd>
        </dl>
        {state && state.root && state.root !== state.publishedRoot && (
          <p style={{ marginBottom: 16 }}>
            <span className="badge danger">drift</span>{" "}
            <span style={{ color: "var(--fg-soft)", fontSize: 14 }}>
              Off-chain root differs from on-chain — publish to sync.
            </span>
          </p>
        )}
        <button type="button" onClick={publishRoot} disabled={busy || !state?.root}>
          Publish current root on-chain
        </button>
      </div>

      <div className="card">
        <h2>Add holder commitment</h2>
        <p className="card__sub">Paste a single decimal commitment from a holder device.</p>
        <label className="field-label" htmlFor="commitment-single">
          Commitment
        </label>
        <textarea
          id="commitment-single"
          rows={3}
          value={newCommitment}
          onChange={(e) => setNewCommitment(e.target.value)}
          placeholder="Paste Semaphore identity commitment (decimal)"
        />
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" onClick={addMember} disabled={busy || !newCommitment.trim()}>
            Add to off-chain group
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Batch import</h2>
        <p className="card__sub">
          Paste multiple commitments (one per line or comma-separated) to onboard KYC&apos;d
          investors at once.
        </p>
        <label className="field-label" htmlFor="commitment-batch">
          Commitments
        </label>
        <textarea
          id="commitment-batch"
          rows={4}
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          placeholder={"commitment_1\ncommitment_2\ncommitment_3"}
        />
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" onClick={addBatch} disabled={busy || !batchInput.trim()}>
            Import batch
          </button>
        </div>
      </div>

      {/* ── HashKey KYC Gate (Demo) ──────────────────────────────────────────── */}
      <div className="card card--accent">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>HashKey KYC Gate</h2>
          <span className="badge" style={{ background: "var(--gold-muted)", color: "var(--gold)", flexShrink: 0, marginTop: 2 }}>
            ⚗ Demo only
          </span>
        </div>
        <p className="card__sub">
          In production this uses real HashKey KYC SBT. Here you can simulate approval/revocation directly for demo purposes.
        </p>

        {/* Status + toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <span
            className="badge"
            style={{
              background: kycEnabled ? "var(--accent)" : "rgba(255,255,255,0.08)",
              color: kycEnabled ? "var(--accent-fg)" : "var(--fg-soft)",
              fontSize: 12,
            }}
          >
            {kycEnabled ? "✓ KYC Enabled" : "KYC Disabled"}
          </span>
          <button type="button" onClick={toggleKyc} disabled={busy} style={{ minHeight: 36, padding: "0 16px", fontSize: 13 }}>
            {kycEnabled ? "Disable" : "Enable"} KYC check
          </button>
          {!kycEnabled && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              — <code>admit()</code> skips KYC in demo mode
            </span>
          )}
        </div>

        {/* Mock KYC approval */}
        <label className="field-label" htmlFor="kyc-address">
          Simulate KYC for wallet
        </label>
        <input
          id="kyc-address"
          value={kycAddress}
          onChange={(e) => {
            setKycAddress(e.target.value);
            setKycAddressStatus(null);
          }}
          onBlur={() => checkKycStatus(kycAddress)}
          placeholder="0x…"
        />
        {kycAddressStatus !== null && (
          <p style={{ marginTop: 6, fontSize: 13, color: kycAddressStatus ? "var(--accent)" : "var(--fg-soft)" }}>
            {kycAddressStatus ? "✓ KYC approved" : "✗ No KYC SBT"}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setKycApproval(true)} disabled={busy || !kycAddress.trim()}>
            Approve KYC
          </button>
          <button
            type="button"
            onClick={() => setKycApproval(false)}
            disabled={busy || !kycAddress.trim()}
            style={{ background: "var(--fg-soft)" }}
          >
            Revoke KYC
          </button>
        </div>
      </div>
      {/* ────────────────────────────────────────────────────────────────────── */}

      <div className="card">
        <h2>Mint PrivateRWA</h2>
        <p className="card__sub">Only use addresses that have completed self-admission for this token.</p>
        <div className="row">
          <label htmlFor="mint-token">Token</label>
          <div id="mint-token" className="mono">
            {PRIVATE_RWA_ADDRESS}
          </div>
        </div>
        <label className="field-label" htmlFor="mint-to">
          Recipient (admitted)
        </label>
        <input id="mint-to" value={mintTo} onChange={(e) => setMintTo(e.target.value)} placeholder="0x…" />
        <label className="field-label" htmlFor="mint-amt" style={{ marginTop: 14 }}>
          Amount
        </label>
        <input id="mint-amt" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" onClick={mint} disabled={busy || !mintTo || !mintAmount}>
            Mint
          </button>
        </div>
      </div>

      {state && state.members.length > 0 && (
        <div className="card">
          <h2>Members ({state.size})</h2>
          <p className="card__sub">
            These commitments are only visible in this dashboard. They are never published
            on-chain — only the Merkle root above.
          </p>
          <pre className="log">{state.members.map((m, i) => `#${i}  ${m}`).join("\n")}</pre>
        </div>
      )}

      <div className="card">
        <h2>Activity log</h2>
        <pre className="log">{log.length === 0 ? "(quiet)" : log.join("\n")}</pre>
      </div>
    </div>
  );
}
