# NULLGATE — The investor list stays private. Compliance stays on-chain.

> A privacy-preserving compliance layer for institutional RWA tokens on HashKey Chain.

**Demo Video:** [link]
**Live App:** [link]
**GitHub:** [link]

---

## The Problem

Institutional RWA tokens — tokenized bonds, funds, real estate — use **ERC-3643 (T-REX)** as the compliance standard. It works. But it has one critical flaw that blocks institutional adoption:

> **The entire investor list is public.**

Anyone can query the on-chain identity registry and enumerate every whitelisted holder — wallets, balances, and all.

For family offices and institutional LPs, this isn't a minor inconvenience. It's a dealbreaker.

| What gets exposed | Who exploits it |
|---|---|
| Full LP list | Competitor funds front-run your allocations |
| All whitelisted wallets | Journalists publish your investor roster |
| Holder addresses | Social engineering targets become trivial |

---

## The Solution

Keep the allowlist **off-chain**. Prove membership with **zero-knowledge proofs**. Enforce compliance **on-chain**.

The issuer stores KYC-verified identity commitments in a Semaphore group — off-chain, private. Only a 32-byte Merkle root is published on-chain. Holders self-admit by generating a ZK proof in their browser. The contract verifies the proof and records the address — **with no link to which identity they are**.

Every subsequent transfer is a standard ERC-20 check. No per-transaction proof. No overhead.

---

## Architecture

![System Architecture — NULLGATE](./RWA-zk.png)

---

## How It Works

**Step 1 — Off-Chain Group**
The issuer collects KYC'd identity commitments. The full list never touches the blockchain — stored in Upstash Redis (production) or local JSON (dev).

**Step 2 — Publish Root**
One transaction: `ComplianceGate.updateRoot(merkleRoot)`. A single hash goes on-chain. The investor list stays invisible.

**Step 3 — Self-Admission** *(once per holder per token)*
The holder generates a Groth16 ZK proof in their browser (~3 seconds, WASM). Submits `admit(token, proof)`. The contract runs two checks in sequence:
1. **ZK verification** — Semaphore verifier confirms the proof is valid and the nullifier is unused.
2. **HashKey KYC check** *(when enabled)* — `ComplianceGate` calls `kycSBT.isHuman(msg.sender)` to confirm the wallet holds a HashKey KYC Soul Bound Token.

Both checks must pass. The address is recorded — **no link to their identity is ever revealed.**

**Step 4 — Compliant Transfer** *(every trade, zero proof cost)*
Standard `transfer()`. The `_update` hook checks `isAdmitted(from) && isAdmitted(to)`. Non-admitted recipient → `revert NotAdmitted(addr)`.

---

## Operational Flow

The following sequence diagram shows the complete message flow across all system actors — from off-chain allowlist setup to on-chain compliant transfer, including HashKey KYC verification at the admission stage.

![Sequence Diagram — four-phase operational flow](./asset/flow2.png)

---

## Three Core Primitives

### 🔐 ComplianceGate.sol

The compliance core. Stores the Merkle root with a 16-slot rolling history — handles race conditions between proof generation and root updates. Verifies Semaphore Groth16 proofs on-chain using BN254 pairing precompiles (EIP-196/197), verified live on HashKey Chain.

Includes a `kycEnabled` flag (issuer-controlled) that optionally gates admission on the **HashKey KYC SBT** — the same `isHuman()` interface used by HashKey Chain's native on-chain identity registry. In demo mode the flag is off; flipping it on enforces dual-layer compliance: ZK membership proof + official KYC status.

---

### 🧠 In-Browser ZK Admission

Zero custom circuits. The entire ZK layer uses **Semaphore v4** — an audited, production-grade anonymous signalling protocol by PSE. Proof generation runs entirely client-side via WASM in ~3 seconds.

The `Admitted` event on-chain contains only a nullifier hash. No commitment. No group index. Nothing an observer can trace back to an identity.

---

### 🔒 ERC-20 Compliance Hook

`PrivateRWA.sol` is a standard OpenZeppelin ERC-20 extended with one hook. Every transfer — including mints — runs through `ComplianceGate.isAdmitted()`. Non-admitted transfers revert with a custom error. Compliance is enforced by the contract itself, not by an off-chain monitor.

---

## Privacy Comparison

| | ERC-3643 | NULLGATE |
|---|---|---|
| Full investor list | **Public** | **Private** |
| Identity ↔ address link | Exposed | Unlinkable |
| Competitor can enumerate holders | Yes | No |
| On-chain compliance enforcement | Yes | Yes |
| Per-transfer proof overhead | None | None |
| KYC integration | On-chain registry (public) | HashKey KYC SBT + ZK (private) |
| Custom ZK circuits | — | **Zero** |

---

## Live on HashKey Chain Testnet

| Contract | Address |
|---|---|
| ComplianceGate | `0x4285f449Eea37AC09F539a47aad648F745aA2280` |
| PrivateRWA (ZKCB) | `0x5DC81BA1E0c493A0FD8e4f2300541F0436c30d48` |
| MockKycSBT *(demo)* | `0x2F624D17B2BE9c96C3A89AEE68546ad4D9EA8130` |

BN254 pairing precompiles (`ecAdd`, `ecMul`, `ecPairing`) verified on Chain ID 133 before building.

---

## Tech Stack

| | |
|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| ZK Protocol | Semaphore v4 — zero custom circuits |
| Proving | In-browser WASM, Groth16 / BN254 |
| KYC Integration | HashKey KYC SBT (`isHuman` interface) + MockKycSBT (demo) |
| Frontend & API | Next.js 14, TypeScript, viem |
| Group Store | Upstash Redis (prod) / local JSON (dev) |
| Chain | HashKey Chain Testnet — Chain ID 133 |
