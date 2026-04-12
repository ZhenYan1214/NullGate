"use client";

export default function ComparePage() {
  return (
    <div>
      <header className="page-header">
        <p className="page-header__eyebrow">Analysis</p>
        <h1>ERC-3643 vs ZK-RWA Allowlist</h1>
        <p className="page-header__desc">
          Side-by-side: what the public sees in each model. Same five institutional investors,
          same compliance outcome — different privacy exposure.
        </p>
      </header>

      <div className="compare-grid">
        <div className="card card--danger">
          <h2 style={{ color: "var(--danger)" }}>ERC-3643 (T-REX)</h2>
          <p className="card__sub">
            On-chain Identity Registry — anyone can call <code>isVerified(addr)</code> and
            enumerate every holder via events.
          </p>
          <div className="code-block code-block--danger">
            <div className="code-warn" style={{ marginBottom: 8 }}>
              // Identity Registry — FULLY PUBLIC
            </div>
            <div>
              IdentityRegistry.isVerified(
              <span className="code-addr">0x742d…Fb4a</span>) → <span className="code-warn">true</span>
            </div>
            <div>
              IdentityRegistry.isVerified(
              <span className="code-addr">0x8ba1…3e21</span>) → <span className="code-warn">true</span>
            </div>
            <div>
              IdentityRegistry.isVerified(
              <span className="code-addr">0xf39F…92d0</span>) → <span className="code-warn">true</span>
            </div>
            <div>
              IdentityRegistry.isVerified(
              <span className="code-addr">0x70997…0a7e</span>) → <span className="code-warn">true</span>
            </div>
            <div>
              IdentityRegistry.isVerified(
              <span className="code-addr">0x3C44…93aF</span>) → <span className="code-warn">true</span>
            </div>
            <br />
            <div className="code-warn">// Anyone can enumerate all 5 investors via events:</div>
            <div className="code-warn">
              // → IdentityRegistered(0x742d…), IdentityRegistered(0x8ba1…), …
            </div>
            <br />
            <div className="code-warn" style={{ fontWeight: 600 }}>
              ⚠ Competitor funds can front-run your LP allocation.
            </div>
            <div className="code-warn" style={{ fontWeight: 600 }}>
              ⚠ Journalists can publish your full investor list.
            </div>
            <div className="code-warn" style={{ fontWeight: 600 }}>
              ⚠ Social engineering targets are trivially identifiable.
            </div>
          </div>
        </div>

        <div className="card card--accent">
          <h2 style={{ color: "var(--accent)" }}>ZK-RWA Allowlist (ours)</h2>
          <p className="card__sub">
            Off-chain Semaphore group — only the Merkle root is public. Members self-admit
            via ZK proof. No link between commitment and address.
          </p>
          <div className="code-block code-block--ok">
            <div className="code-accent" style={{ marginBottom: 8 }}>
              // ComplianceGate — only root is public
            </div>
            <div>
              ComplianceGate.currentRoot() →{" "}
              <span className="code-addr">0x15a8…7c3b</span>
            </div>
            <br />
            <div className="code-muted">// Off-chain group (issuer backend only):</div>
            <div className="code-muted">// [commitment_0, commitment_1, …, commitment_4]</div>
            <div className="code-muted">// → NOT on-chain. NOT in events. NOT queryable.</div>
            <br />
            <div className="code-accent">// Admitted set (public by necessity, but unlinkable):</div>
            <div>
              admitted[HKGB30][<span className="code-addr">0xf39F…</span>] = true
            </div>
            <div>
              admitted[HKGB30][<span className="code-addr">0x742d…</span>] = true
            </div>
            <div className="code-muted">// ↑ Which commitment = which address? Unknown.</div>
            <div className="code-muted">// ↑ Who HASN&apos;T admitted yet? Unknown.</div>
            <div className="code-muted">// ↑ How many members total? Unknown.</div>
            <br />
            <div className="code-accent" style={{ fontWeight: 600 }}>
              ✓ Allowlist stays private — only self-admitted addresses are visible.
            </div>
            <div className="code-accent" style={{ fontWeight: 600 }}>
              ✓ Transfers are standard ERC-20 — no per-tx proof overhead.
            </div>
            <div className="code-accent" style={{ fontWeight: 600 }}>
              ✓ Compliance is enforced on-chain — non-admitted transfers revert.
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h2>Why institutions care</h2>
        <p className="card__sub">Same bar for transfer rules; different surface for reconnaissance.</p>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Risk</th>
                <th>ERC-3643</th>
                <th>ZK-RWA Allowlist</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Competitor front-running LP allocation", "Exposed", "Hidden"],
                ["Journalist enumerating investor list", "Trivial via events", "Impossible"],
                ["Social engineering of known holders", "Addresses public", "Only self-admitted visible"],
                ["Regulatory compliance (transfer gating)", "✓ On-chain", "✓ On-chain"],
                ["Issuer can revoke / freeze", "✓ Direct registry update", "✓ Stop publishing new roots"],
                ["Per-transfer proof overhead", "None", "None (admission is one-time)"],
              ].map(([risk, erc, zk], i) => (
                <tr key={i}>
                  <td className="col-risk">{risk}</td>
                  <td className={erc?.startsWith("✓") ? "cell-good" : "cell-bad"}>{erc}</td>
                  <td
                    className={
                      zk?.startsWith("✓") ||
                      zk === "Hidden" ||
                      zk === "Impossible" ||
                      zk?.startsWith("Only") ||
                      zk?.startsWith("None")
                        ? "cell-good"
                        : "cell-bad"
                    }
                  >
                    {zk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
