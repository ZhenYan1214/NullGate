<p align="center">
  <strong>ZK-RWA Allowlist</strong><br>
  <em>Privacy-preserving compliance for institutional RWA tokens</em>
</p>

<p align="center">
  <a href="#why-this-matters">Why this matters</a> &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;·&nbsp;
  <a href="#getting-started">Getting started</a> &nbsp;·&nbsp;
  <a href="#demo-flow">Demo flow</a>
</p>

---

## The Problem

**ERC-3643 (T-REX)** is the de-facto standard for permissioned RWA tokens — tokenized bonds, funds, real estate. It enforces holder KYC through an on-chain identity registry, but that registry is **fully public**: anyone can enumerate every whitelisted investor by reading contract state or scanning `IdentityRegistered` events.

```
// ERC-3643 Identity Registry — FULLY PUBLIC
IdentityRegistry.isVerified(0x742d…Fb4a) → true
IdentityRegistry.isVerified(0x8ba1…3e21) → true
IdentityRegistry.isVerified(0xf39F…92d0) → true

// Anyone can enumerate all investors via events:
// → IdentityRegistered(0x742d…), IdentityRegistered(0x8ba1…), …
```

For family offices, qualified investors, and institutional LPs, this is a **non-starter**:

| Threat | Impact |
| --- | --- |
| Competitor reconnaissance | Front-run LP allocation by watching registry additions |
| Journalist enumeration | Publish full investor list from publicly indexed events |
| Social engineering | Target high-net-worth holders identified on-chain |
| Regulatory arbitrage | Competitors gain insights into fund strategy |

> **The institutional ask is simple**: _"Don't leak my LP list."_ ERC-3643 does exactly that.

---

## Why This Matters

Tokenized real-world assets on **HashKey Chain** — a compliance-first, SFC-licensed L2 — need a privacy layer that doesn't sacrifice regulatory enforceability. Institutional capital will not flow into on-chain products where investor identities are public by design.

**ZK-RWA Allowlist** bridges this gap: **allowlist-level privacy with on-chain compliance enforcement**, using zero-knowledge proofs to decouple identity from access.

---

## How It Works

The issuer's holder list stays **off-chain** as a [Semaphore v4](https://docs.semaphore.pse.dev) group. Only the **Merkle root** is published on-chain. Holders self-admit by generating a ZK proof of group membership — the contract records `admitted[token][address] = true` without ever learning which identity commitment maps to which address.

### Four-step flow

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                                                                     │
 │  1. OFF-CHAIN       Issuer adds KYC'd identity commitments         │
 │     GROUP           to a Semaphore group. The full list             │
 │                     never touches the blockchain.                   │
 │                              │                                      │
 │                              ▼                                      │
 │  2. PUBLISH         Issuer calls updateRoot(merkleRoot).            │
 │     ROOT            Only the 32-byte root goes on-chain.            │
 │                              │                                      │
 │                              ▼                                      │
 │  3. SELF-           Holder generates a Semaphore ZK proof           │
 │     ADMISSION       in their browser (~3s) and submits              │
 │                     admit(token, proof). Contract verifies           │
 │                     and records address. No link to commitment.      │
 │                              │                                      │
 │                              ▼                                      │
 │  4. TRANSFER        Standard ERC-20 transfer. The _update           │
 │                     hook checks isAdmitted(from) && isAdmitted(to). │
 │                     Non-admitted recipients cause a revert.          │
 │                                                                     │
 └─────────────────────────────────────────────────────────────────────┘
```

### Privacy model

| Property | Visibility | Reason |
| --- | --- | --- |
| Full allowlist of identity commitments | **Private** | Stored off-chain in issuer backend only |
| Which group member corresponds to which address | **Private** | ZK proof reveals nothing beyond membership |
| Set of admitted addresses | Public | Required for transfer hook to check without per-tx proof |
| Individual token holdings | Public | Standard ERC-20 (shielded pools out of scope) |

**Trade-off**: this is _allowlist-level_ privacy, not transaction-level privacy. Stealth addresses and shielded pools are explicitly out of scope — the institutional ask is "don't leak my LP list", not "hide my transactions".

---

## Architecture

```
┌──────────────────────┐              ┌──────────────────────────┐
│   Issuer Backend     │              │   Holder Browser         │
│   (Next.js API)      │              │                          │
│                      │              │   Semaphore Identity     │
│   Semaphore Group    │              │   (localStorage)         │
│   [c₀, c₁, c₂, …]  │              │                          │
│                      │              │   @semaphore-protocol/   │
│   POST /add-member   │              │     proof (WASM)         │
│   POST /publish-root │              │                          │
└──────────┬───────────┘              └────────────┬─────────────┘
           │                                       │
           │  updateRoot(newRoot)                   │  admit(token, root, depth,
           │  registerToken(token)                  │        nullifier, proof)
           │  mint(to, amount)                      │
           │     ↓ (issuer wallet)                  │     ↓ (holder wallet)
┌──────────┴───────────────────────────────────────┴─────────────────┐
│                                                                     │
│                  HashKey Chain Testnet (Chain ID: 133)               │
│                                                                     │
│  ┌─────────────────────────┐      ┌──────────────────────────────┐  │
│  │   ComplianceGate.sol    │      │   SemaphoreVerifier          │  │
│  │                         │─────▶│   (stock Semaphore contract, │  │
│  │   currentRoot           │      │    bn254 pairing)            │  │
│  │   admitted[token][addr] │      └──────────────────────────────┘  │
│  │   usedNullifier[hash]   │                                        │
│  │   rootHistory[16]       │                                        │
│  │                         │                                        │
│  │   updateRoot()          │                                        │
│  │   admit()               │                                        │
│  │   isAdmitted()          │                                        │
│  └────────────┬────────────┘                                        │
│               │                                                     │
│               │  isAdmitted(from) && isAdmitted(to)                 │
│               ▼                                                     │
│  ┌─────────────────────────┐                                        │
│  │   PrivateRWA.sol        │                                        │
│  │   ERC-20 + _update hook │                                        │
│  │                         │                                        │
│  │   mint() → onlyIssuer   │                                        │
│  │   transfer() / send()   │                                        │
│  │   _update() → gate check│                                        │
│  └─────────────────────────┘                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Contract design

**`ComplianceGate.sol`** (~110 lines) — the compliance core:
- Maintains a rolling history of the last 16 Merkle roots (handles the race between proof generation and root updates)
- Verifies Semaphore Groth16 proofs via the stock `SemaphoreVerifier`
- Nullifier scoping: `scope = hash(tokenAddress)` — same group member can admit to multiple tokens independently
- Message binding: `message = hash(msg.sender)` — proof is bound to the calling address

**`PrivateRWA.sol`** (~45 lines) — a minimal ERC-20:
- `_update` hook calls `gate.isAdmitted()` for both sender and recipient
- Mints skip the sender check (`from == address(0)`), burns skip the recipient check
- Issuer-only `mint()` function for token distribution

### ZK component

**Zero custom circuits.** The entire ZK layer is [Semaphore v4](https://docs.semaphore.pse.dev) — an audited, production-grade protocol for anonymous group membership proofs built on bn254 (Groth16). Proof generation happens entirely in the browser via WASM (~3 seconds after artifact cache).

---

## ERC-3643 vs ZK-RWA Allowlist

| | ERC-3643 | ZK-RWA Allowlist |
| --- | --- | --- |
| Investor list visibility | **Public** — events + storage | **Private** — off-chain group |
| Identity ↔ address link | Direct on-chain mapping | Unlinkable (ZK proof) |
| Competitor front-running | LP list exposed | Hidden |
| Transfer compliance | On-chain gating | On-chain gating |
| Per-transfer overhead | None | None (one-time admission) |
| Custom ZK circuits | N/A | **Zero** — Semaphore v4 |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Smart contracts | Solidity 0.8.24, Foundry, OpenZeppelin ERC-20 |
| ZK protocol | Semaphore v4.14 (`@semaphore-protocol/contracts`) |
| Client-side proving | `@semaphore-protocol/{identity,group,proof}` (in-browser WASM) |
| Frontend | Next.js 14 (App Router), TypeScript, viem |
| Deployment | HashKey Chain testnet (chainId 133) |

---

## Repository Structure

```
contracts/
  src/
    ComplianceGate.sol     Merkle root registry + ZK-proof admission
    PrivateRWA.sol         ERC-20 with compliance hook
  test/
    ComplianceGate.t.sol   Foundry tests (12 passing)
  script/
    Deploy.s.sol           One-shot deployment script
lib/
  semaphore/
    group.ts               Server-side Semaphore group management
    identity.ts            Browser-side identity generation
    proof.ts               Browser-side ZK proof generation
  chain/
    abi.ts                 Contract ABIs
    config.ts              Chain config + deployed addresses
    browserClient.ts       viem browser client (wallet interaction)
    issuerClient.ts        viem server client (issuer transactions)
app/
  page.tsx                 Landing page
  join/page.tsx            Holder: create identity + display commitment
  admit/page.tsx           Holder: generate ZK proof + submit admission
  wallet/page.tsx          Holder: balance + transfer
  issuer/page.tsx          Issuer: dashboard + group management + minting
  compare/page.tsx         ERC-3643 vs ZK-RWA side-by-side analysis
  api/
    group/root/            GET current off-chain Merkle root
    group/merkle-path/     GET Merkle path for a commitment
    issuer/add-member/     POST add commitment to off-chain group
    issuer/publish-root/   POST publish root on-chain
    issuer/mint/           POST mint tokens to admitted address
data/
  group.json               Issuer-side Semaphore group state
scripts/
  day0-semaphore-check.ts  Semaphore v4 end-to-end sanity check
  day0-chain-check.ts      bn254 precompile verification on chain 133
docs/                      Technical deep-dive documentation
pitch/                     Presentation deck
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- A wallet with HSK testnet tokens ([faucet](https://testnet.hsk.xyz))

### Install & Build

```bash
npm install
cd contracts && forge install && cd ..
```

### Run Sanity Checks

```bash
# Verify Semaphore v4 proof generation works locally
npx tsx scripts/day0-semaphore-check.ts

# Verify bn254 precompiles on HashKey Chain testnet
npx tsx scripts/day0-chain-check.ts
```

### Contract Tests

```bash
cd contracts && forge test -vv
```

### Deploy Contracts

```bash
cp .env.example .env
# Edit .env: set ISSUER_PRIVATE_KEY (fund with HSK first)

cd contracts
forge script script/Deploy.s.sol --rpc-url $HASHKEY_TESTNET_RPC --broadcast

# Copy the printed addresses into .env:
#   NEXT_PUBLIC_COMPLIANCE_GATE_ADDRESS=0x...
#   NEXT_PUBLIC_PRIVATE_RWA_ADDRESS=0x...
```

### Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Demo Flow

> 3 pre-seeded KYC'd holders in the group. One `HKGB30` token registered on-chain.

**1. Issuer dashboard** (`/issuer`)
  - View 3 private commitments, current Merkle root on-chain, 0 admitted addresses

**2. New holder onboarding** (`/join`)
  - Holder creates a Semaphore identity in-browser → copies commitment
  - Issuer pastes commitment → adds to group → publishes new root on-chain

**3. Self-admission** (`/admit`)
  - Holder generates ZK proof in browser (~3s) → submits `admit()` transaction
  - Explorer shows `Admitted` event with nullifier hash — **no link to commitment**

**4. Token distribution** (`/issuer`)
  - Issuer mints 100 HKGB30 to the admitted holder

**5. Compliant transfer** (`/wallet`)
  - Transfer to a second admitted address → succeeds
  - Transfer to a non-admitted address → **reverts with `NotAdmitted`**

---

## Scope & Limitations

This is a hackathon prototype demonstrating the core primitive. Explicit scope cuts:

- **No transaction-level privacy** — no shielded pool or stealth addresses
- **Single issuer** — one hardcoded issuer wallet (no multi-tenant)
- **No identity revocation** — documented as future work
- **No ERC-3643 conformance** — intentionally an alternative, not an extension
- **No production KYC** — demo trusts commitments without external verification

---

## License

MIT
