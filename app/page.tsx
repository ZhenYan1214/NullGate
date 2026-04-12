import Link from "next/link";

export default function Home() {
  return (
    <div className="hero">
      <span className="badge">ZKID · HashKey On-Chain Horizon</span>
      <h1 className="hero__title">ERC-3643 for institutions that actually care about privacy.</h1>
      <p className="lead">
        ZK-RWA Allowlist keeps the issuer&apos;s holder list off-chain as a Semaphore group.
        Only the Merkle root hits chain. Holders self-admit by proving membership — without
        revealing which group member they are. Transfers stay standard ERC-20.
      </p>

      <div className="pill-row">
        <Link href="/join" className="btn btn-primary">
          Holder: create identity
        </Link>
        <Link href="/issuer" className="btn btn-secondary">
          Issuer dashboard
        </Link>
      </div>

      <div className="feature-grid">
        <div className="card">
          <h2>How it works</h2>
          <p className="card__sub">Four steps from private allowlist to compliant transfers.</p>
          <ol className="feature-list">
            <li>
              <strong>Off-chain:</strong> Issuer maintains a Semaphore group of KYC&apos;d holder
              identity commitments. The full list never leaves their backend.
            </li>
            <li>
              <strong>Root published:</strong> Issuer calls{" "}
              <code>ComplianceGate.updateRoot(merkleRoot)</code>. Only the root is public.
            </li>
            <li>
              <strong>Self-admission:</strong> Each holder generates a Semaphore proof in their
              browser that they belong to the group, scoped to a specific token. They submit{" "}
              <code>admit(token, proof…)</code>. The contract verifies the proof and records their
              address in <code>admitted[token][holder]</code>. <em>No link to their commitment.</em>
            </li>
            <li>
              <strong>Transfers:</strong> <code>PrivateRWA</code> is a standard ERC-20 whose{" "}
              <code>_update</code> hook reverts unless both sides are admitted.
            </li>
          </ol>
        </div>

        <div className="card">
          <h2>What&apos;s private?</h2>
          <p className="card__sub">Clear expectations for auditors and product teams.</p>
          <ul className="feature-list">
            <li>
              <strong>Private:</strong> the full allowlist — only members who choose to self-admit
              ever appear anywhere public.
            </li>
            <li>
              <strong>Private:</strong> which group member corresponds to which on-chain address.
            </li>
            <li>
              <strong>Public by design:</strong> the set of admitted addresses (must be, so the
              transfer hook can check without requiring a proof per transfer).
            </li>
          </ul>
          <p className="hint" style={{ marginTop: 20 }}>
            This is allowlist-level privacy, not tx-level. Stealth addresses / shielded pools are
            explicitly out of scope — the institutional ask is &ldquo;don&apos;t leak my LP list&rdquo;,
            which is exactly what ERC-3643 does and this fixes.
          </p>
        </div>
      </div>
    </div>
  );
}
