import Link from "next/link";

export default function Home() {
  return (
    <div className="simple-home">
      <section className="simple-home__hero">
        <span className="badge">ZKID · HashKey On-Chain Horizon</span>
        <h1 className="hero__title">Private allowlist. Standard ERC-20 transfer.</h1>
        <p className="lead">
          Issuers keep KYC lists off-chain. Holders prove membership with zero-knowledge and self-admit.
          On-chain only stores what transfer checks need.
        </p>
        <div className="pill-row">
          <Link href="/join" className="btn btn-primary">
            Holder flow
          </Link>
          <Link href="/issuer" className="btn btn-secondary">
            Issuer flow
          </Link>
        </div>
      </section>

      <section className="simple-home__points">
        <article className="simple-item">
          <h3>Private by default</h3>
          <p>Full allowlist stays off-chain.</p>
        </article>
        <article className="simple-item">
          <h3>Auditable on-chain</h3>
          <p>Only root and admitted addresses are public.</p>
        </article>
        <article className="simple-item">
          <h3>No wallet friction</h3>
          <p>Users still transfer with standard ERC-20 behavior.</p>
        </article>
      </section>

      <section className="simple-home__flow card">
        <h2>How it works</h2>
        <ol className="simple-flow">
          <li>Issuer maintains Semaphore group off-chain.</li>
          <li>Issuer publishes the latest Merkle root.</li>
          <li>Holder self-admits and transfer hook enforces compliance.</li>
        </ol>
      </section>
    </div>
  );
}
