# ZK-RWA Allowlist

**ERC-3643 for institutions that actually care about privacy.**

ERC-3643 (T-REX) is the de-facto standard for permissioned RWA tokens — tokenized bonds,
funds, real estate. It enforces holder KYC via an on-chain identity registry, but that
registry is **fully public**: anyone can enumerate every whitelisted holder. For family
offices, qualified investors, and institutional LPs, this is a non-starter.

**ZK-RWA Allowlist** keeps the issuer's allowlist off-chain as a [Semaphore v4][sem] group
and only publishes the Merkle root. Holders self-admit by submitting a ZK proof of group
membership — the contract records `admitted[token][addr] = true` without ever learning
which identity corresponds to which on-chain address. Transfers are standard ERC-20, gated
by `isAdmitted(from) && isAdmitted(to)`.

## Architecture

```
┌──────────────────┐         ┌─────────────────────┐
│  Issuer backend  │         │  Holder wallet      │
│  (Next.js API)   │         │  (browser)          │
│                  │         │                     │
│  • Semaphore     │         │  • Semaphore        │
│    Group store   │         │    Identity (local) │
│  • publishRoot() │─────────┤  • Generate proof   │
└────────┬─────────┘         └──────────┬──────────┘
         │                              │
         │ updateRoot(newRoot)          │ admit(proof, publicSignals)
         │ (issuer role)                │
         ▼                              ▼
┌──────────────────────────────────────────────────┐
│       HashKey Chain (chain 133)                  │
│  ┌────────────────────┐    ┌──────────────────┐  │
│  │ ComplianceGate.sol │    │ SemaphoreVerifier│  │
│  │  merkleRoot        │───▶│   (stock)        │  │
│  │  admitted[tok][a]  │    └──────────────────┘  │
│  │  admit()           │                          │
│  │  isAdmitted()      │                          │
│  └─────────┬──────────┘                          │
│            │ isAdmitted(from) && isAdmitted(to)  │
│            ▼                                     │
│  ┌────────────────────┐                          │
│  │ PrivateRWA.sol     │                          │
│  │  ERC-20 + hook     │                          │
│  └────────────────────┘                          │
└──────────────────────────────────────────────────┘
```

## What's private / public

| Property                                     | Public                  | Private |
| -------------------------------------------- | ----------------------- | ------- |
| Full allowlist of identity commitments       |                         | ✓       |
| Which group member corresponds to which addr |                         | ✓       |
| Set of admitted addresses                    | ✓ (required for hook)   |         |
| Individual holdings                          | ✓ (standard ERC-20)     |         |

Trade-off: **allowlist-level privacy**, not transaction-level privacy. Stealth addresses
and shielded pools are explicitly out of scope — the institutional ask is "don't leak my
LP list", which ERC-3643 does and this fixes.

## Repo layout

```
contracts/           Foundry — ComplianceGate.sol, PrivateRWA.sol, tests, deploy script
lib/semaphore/       Server-side group store + browser identity/proof helpers
lib/chain/           viem clients + ABIs + chain config
app/                 Next.js 14 app-router pages + API routes
scripts/             Day 0 sanity scripts (Semaphore JS + bn254 precompile probe)
data/group.json      Issuer-side Semaphore group state (seed for demo)
```

## Quickstart

```bash
# 1. Install
npm install
cd contracts && forge install && cd ..

# 2. Run Day 0 sanity checks
npx tsx scripts/day0-semaphore-check.ts      # local Semaphore proof gen
npx tsx scripts/day0-chain-check.ts          # HashKey chain 133 bn254 precompiles

# 3. Contract tests
cd contracts && forge test -vv

# 4. Deploy (fund ISSUER_PRIVATE_KEY with HSK first)
cp ../.env.example ../.env
# edit .env and set ISSUER_PRIVATE_KEY
forge script script/Deploy.s.sol --rpc-url $HASHKEY_TESTNET_RPC --broadcast
# copy the printed addresses into .env (NEXT_PUBLIC_COMPLIANCE_GATE_ADDRESS, NEXT_PUBLIC_PRIVATE_RWA_ADDRESS)

# 5. Run the frontend
cd ..
npm run dev
```

Then:

- `/join` — holder creates an identity, copies commitment
- `/issuer` — admin pastes commitment, publishes new root, mints after admission
- `/admit` — holder generates proof in browser and submits `admit()`
- `/wallet` — balance + transfer. Transfer to unadmitted address reverts.

## End-to-end demo flow

1. 3 pre-seeded KYC'd holders already in the group. One `HKGB30` token registered.
2. Issuer dashboard shows commitments privately, current Merkle root on-chain, 0 admitted.
3. Holder creates identity at `/join`, copies commitment, issuer pastes + publishes.
4. Holder goes to `/admit` → generates proof in wasm (~3s after warm-up) → submits tx →
   explorer shows `Admitted` event with nullifier hash. **No link to commitment.**
5. Issuer mints 100 HKGB30. `/wallet` shows balance.
6. Transfer to a second admitted address → succeeds.
7. Transfer to an unlisted address → reverts with `NotAdmitted`.

## Sanity checks

| Check                         | Result                                   |
| ----------------------------- | ---------------------------------------- |
| Semaphore v4 API shape        | ✓ locked in `scripts/day0-semaphore-check.ts` |
| Proof gen wall-time           | ~2.4s on dev laptop (after artifact cache) |
| bn254 precompiles on chain 133 | ✓ `ecAdd`, `ecMul`, `ecPairing` all respond |
| Contract tests                | 12/12 passing                            |

## Tech stack

- Solidity 0.8.24, Foundry, OpenZeppelin ERC20, `@semaphore-protocol/contracts` v4.14
- `@semaphore-protocol/{identity,group,proof}` v4.14 (in-browser wasm proving)
- Next.js 14 App Router, TypeScript, viem
- Deployed on HashKey Chain testnet (chainId 133)

## Explicit scope cuts

- No transaction-level privacy (no shielded pool, no stealth addresses)
- No multi-issuer — one hardcoded issuer wallet
- No identity revocation (future work)
- No ERC-3643 conformance — we're intentionally *not* ERC-3643

## License

MIT

[sem]: https://docs.semaphore.pse.dev
# ZK-RWA-Allowlist
