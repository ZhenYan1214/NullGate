"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { connectWallet, publicClient, walletClient } from "@/lib/chain/browserClient";
import { COMPLIANCE_GATE_ABI, PRIVATE_RWA_ABI } from "@/lib/chain/abi";
import { COMPLIANCE_GATE_ADDRESS, PRIVATE_RWA_ADDRESS } from "@/lib/chain/config";
import Link from "next/link";

export default function WalletPage() {
  const [address, setAddress] = useState<Address | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [symbol, setSymbol] = useState<string>("");
  const [admitted, setAdmitted] = useState<boolean | null>(null);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function append(line: string) {
    setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);
  }

  async function onConnect() {
    const { address } = await connectWallet();
    setAddress(address);
  }

  async function refresh() {
    if (!address) return;
    const pc = publicClient();
    const [bal, sym, isAd] = await Promise.all([
      pc.readContract({
        address: PRIVATE_RWA_ADDRESS,
        abi: PRIVATE_RWA_ABI,
        functionName: "balanceOf",
        args: [address],
      }),
      pc.readContract({
        address: PRIVATE_RWA_ADDRESS,
        abi: PRIVATE_RWA_ABI,
        functionName: "symbol",
      }),
      pc.readContract({
        address: COMPLIANCE_GATE_ADDRESS,
        abi: COMPLIANCE_GATE_ABI,
        functionName: "isAdmitted",
        args: [PRIVATE_RWA_ADDRESS, address],
      }),
    ]);
    setBalance(bal as bigint);
    setSymbol(sym as string);
    setAdmitted(isAd as boolean);
  }

  useEffect(() => {
    if (address) refresh();
  }, [address]);

  async function onTransfer() {
    if (!address || !to || !amount) return;
    setBusy(true);
    try {
      const wallet = walletClient();
      const hash = await wallet.writeContract({
        account: address,
        address: PRIVATE_RWA_ADDRESS,
        abi: PRIVATE_RWA_ABI,
        functionName: "transfer",
        args: [to as Address, parseUnits(amount, 18)],
      });
      append(`tx sent ${hash}`);
      await publicClient().waitForTransactionReceipt({ hash });
      append("confirmed ✓");
      await refresh();
    } catch (e) {
      append(`ERROR: ${(e as Error).message.slice(0, 180)}`);
    }
    setBusy(false);
  }

  return (
    <div>
      <header className="page-header">
        <p className="page-header__eyebrow">Holder · Wallet</p>
        <h1>My wallet</h1>
        <p className="page-header__desc">
          View your compliance status and move HKGB30. Transfers only succeed when both parties
          are admitted for this token.
        </p>
      </header>

      <div className="card">
        <div className="row">
          <label htmlFor="my-addr">Address</label>
          <div id="my-addr" className="mono">
            {address ?? "(not connected)"}
          </div>
        </div>
        {!address && (
          <button type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}
        {address && (
          <>
            <div className="row">
              <label>Admitted</label>
              <div>
                {admitted === null ? (
                  <span className="mono">…</span>
                ) : admitted ? (
                  <span className="badge">yes</span>
                ) : (
                  <span className="badge danger">no</span>
                )}
                {admitted === false && (
                  <span style={{ marginLeft: 10, fontSize: 13, color: "var(--muted)" }}>
                    Complete <Link href="/admit">self-admission</Link> first.
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {address && balance !== null && (
        <div className="balance-card">
          <div className="balance-card__label">Token balance</div>
          <div className="balance-card__amount">
            {formatUnits(balance, 18)} <span style={{ color: "var(--fg-soft)", fontSize: "0.65em" }}>{symbol}</span>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Transfer</h2>
        <p className="card__sub">Recipient must be admitted or the transaction reverts on-chain.</p>
        <label className="field-label" htmlFor="xfer-to">
          To
        </label>
        <input id="xfer-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
        <label className="field-label" htmlFor="xfer-amt" style={{ marginTop: 14 }}>
          Amount
        </label>
        <input id="xfer-amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" onClick={onTransfer} disabled={busy || !address || !to || !amount}>
            Transfer
          </button>
        </div>
        <p className="hint" style={{ marginTop: 16 }}>
          If the recipient is not admitted, the transfer reverts with{" "}
          <code>NotAdmitted(address)</code>. Compliance is enforced in the token hook — not by an
          off-chain monitor.
        </p>
      </div>

      <div className="card">
        <h2>Log</h2>
        <pre className="log">{log.length === 0 ? "(quiet)" : log.join("\n")}</pre>
      </div>
    </div>
  );
}
