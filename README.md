<p align="center">
  <strong>ZK-RWA Allowlist</strong><br>
  <em>Privacy-preserving compliance for institutional RWA tokens on HashKey Chain</em>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> &nbsp;·&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;·&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;·&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;·&nbsp;
  <a href="#demo-flow">Demo Flow</a>
</p>

---

## The Problem

**ERC-3643 (T-REX)** is the de-facto standard for permissioned RWA tokens — tokenized bonds, funds, real estate. It enforces holder KYC through an on-chain identity registry, but that registry is **fully public**: anyone can enumerate every whitelisted investor by reading contract state or scanning `IdentityRegistered` events.

For family offices, qualified investors, and institutional LPs, this is a **non-starter**:

| Threat | Impact |
| --- | --- |
| Competitor reconnaissance | Front-run LP allocation by watching registry additions |
| Journalist enumeration | Publish full investor list from publicly indexed events |
| Social engineering | Target high-net-worth holders identified on-chain |

> **The institutional ask is simple**: _"Don't leak my LP list."_ ERC-3643 does exactly that.

---

## How It Works

The issuer's holder list stays **off-chain** as a [Semaphore v4](https://docs.semaphore.pse.dev) group. Only the **Merkle root** is published on-chain. Holders self-admit by generating a ZK proof of group membership — the contract records `admitted[token][address] = true` without ever learning which identity commitment maps to which address.

### Four-Step Flow

```
 1. OFF-CHAIN GROUP   Issuer collects KYC'd identity commitments.
                      The full list never touches the blockchain.
                              │
                              ▼
 2. PUBLISH ROOT      Issuer calls updateRoot(merkleRoot).
                      Only a 32-byte root goes on-chain.
                              │
                              ▼
 3. SELF-ADMISSION    Holder generates a ZK proof in-browser (~3s)
                      and submits admit(token, proof).
                      Contract verifies and records address.
                      No link to commitment is ever revealed.
                              │
                              ▼
 4. TRANSFER          Standard ERC-20 transfer. The _update hook
                      checks isAdmitted(from) && isAdmitted(to).
                      Non-admitted recipients cause a revert.
```

### Privacy Model

| Property | Visibility | Reason |
| --- | --- | --- |
| Full allowlist of identity commitments | **Private** | Stored off-chain in issuer backend only |
| Which commitment maps to which address | **Private** | ZK proof reveals nothing beyond membership |
| Set of admitted addresses | Public | Required for transfer hook |
| Individual token holdings | Public | Standard ERC-20 |

**Trade-off**: This is _allowlist-level_ privacy, not transaction-level privacy. Stealth addresses and shielded pools are out of scope — the institutional ask is "don't leak my LP list", not "hide my transactions".

---

## Architecture

![System Architecture](./RWA-zk.png)

### Contracts

**`ComplianceGate.sol`** — the compliance core:
- Maintains a rolling history of the last 16 Merkle roots (handles race between proof generation and root updates)
- Verifies Semaphore Groth16 proofs via the stock `SemaphoreVerifier` (bn254 pairing)
- Nullifier scoping: `scope = hash(tokenAddress)` — same group member can admit to multiple tokens independently
- Message binding: `message = hash(msg.sender)` — proof is bound to the calling address

**`PrivateRWA.sol`** — a minimal ERC-20:
- `_update` hook calls `gate.isAdmitted()` for both sender and recipient on every transfer
- Mints skip the sender check (`from == address(0)`), burns skip the recipient check
- Issuer-only `mint()` function for token distribution

### ZK Component

**Zero custom circuits.** The entire ZK layer uses [Semaphore v4](https://docs.semaphore.pse.dev) — an audited, production-grade protocol for anonymous group membership proofs built on bn254 (Groth16). Proof generation happens entirely in the browser via WASM (~3 seconds).

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
| Frontend / Backend | Next.js 14 (App Router), TypeScript, viem |
| Storage | Upstash Redis (production) / `data/group.json` (local dev) |
| Deployment | HashKey Chain testnet (chainId 133) |

---

## Repository Structure

```
contracts/
  src/
    ComplianceGate.sol     Merkle root registry + ZK-proof admission
    PrivateRWA.sol         ERC-20 with compliance hook
  test/
    ComplianceGate.t.sol   Foundry unit tests
  script/
    Deploy.s.sol           One-shot deployment script
lib/
  semaphore/
    group.ts               Server-side group management (Redis / JSON dual-backend)
    identity.ts            Browser-side identity generation
    proof.ts               Browser-side ZK proof generation
  chain/
    abi.ts                 Contract ABIs
    config.ts              Chain config + deployed addresses
    browserClient.ts       viem browser client (wallet interaction)
    issuerClient.ts        viem server client (issuer transactions)
app/
  page.tsx                 Landing page
  join/page.tsx            Holder: create Semaphore identity + display commitment
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
    issuer/seed-redis/     POST seed Redis from local group.json (post-deploy)
data/
  group.json               Issuer-side Semaphore group state (local dev only)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- A wallet with HSK testnet tokens ([faucet](https://testnet.hsk.xyz))

### Install

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

**1. Issuer dashboard** (`/issuer`)
  - View existing private commitments, current Merkle root on-chain

**2. New holder onboarding** (`/join`)
  - Holder creates a Semaphore identity in-browser → copies commitment
  - Issuer pastes commitment → adds to group → publishes new root on-chain

**3. Self-admission** (`/admit`)
  - Holder connects wallet, generates ZK proof in browser (~3s)
  - Submits `admit()` transaction — explorer shows `Admitted` event with nullifier hash, **no link to commitment**

**4. Token distribution** (`/issuer`)
  - Issuer mints HKGB30 to the admitted holder address

**5. Compliant transfer** (`/wallet`)
  - Transfer to a second admitted address → ✅ succeeds
  - Transfer to a non-admitted address → ❌ reverts with `NotAdmitted`

---

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add all environment variables from `.env.example` in the Vercel dashboard.
3. Additionally, create a free [Upstash Redis](https://upstash.com) database and add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. After the first deploy, call `POST /api/issuer/seed-redis` once to migrate existing `group.json` data to Redis.

> The app auto-detects the backend: Redis in production, `data/group.json` in local dev.

---

## Scope & Limitations

This is a prototype demonstrating the core primitive. Explicit scope cuts:

- **No transaction-level privacy** — no shielded pool or stealth addresses
- **Single issuer** — one hardcoded issuer wallet (no multi-tenant)
- **No identity revocation** — documented as future work
- **No ERC-3643 conformance** — intentionally an alternative, not an extension
- **No production KYC** — demo trusts commitments without external verification

---

## License

MIT
