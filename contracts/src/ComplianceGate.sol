// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ISemaphoreVerifier} from "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

/// @title ComplianceGate
/// @notice Holds a private issuer allowlist as a Semaphore Merkle root. Holders self-admit
/// by submitting a Semaphore ZK proof of membership — the contract records their address
/// in `admitted[token][holder]` without learning which group member they correspond to.
contract ComplianceGate {
    error NotIssuer();
    error UnknownRoot();
    error NullifierReused();
    error InvalidProof();
    error WrongScope();
    error WrongMessage();
    error TokenNotRegistered();
    error TokenAlreadyRegistered();
    error DepthOutOfRange();

    uint256 private constant ROOT_HISTORY_SIZE = 16;
    uint256 private constant MIN_DEPTH = 1;
    uint256 private constant MAX_DEPTH = 32;

    ISemaphoreVerifier public immutable verifier;
    address public immutable issuer;

    uint256 public currentRoot;
    uint256[ROOT_HISTORY_SIZE] public rootHistory;
    uint256 public rootHistoryHead;
    mapping(uint256 => bool) public knownRoot;

    mapping(uint256 => bool) public usedNullifier;
    mapping(address => mapping(address => bool)) public admitted;
    mapping(address => bool) public registeredToken;

    event RootUpdated(uint256 indexed newRoot);
    event TokenRegistered(address indexed token);
    event Admitted(address indexed token, address indexed holder, uint256 nullifier);

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor(address _verifier, address _issuer) {
        verifier = ISemaphoreVerifier(_verifier);
        issuer = _issuer;
    }

    function updateRoot(uint256 newRoot) external onlyIssuer {
        currentRoot = newRoot;
        rootHistory[rootHistoryHead] = newRoot;
        rootHistoryHead = (rootHistoryHead + 1) % ROOT_HISTORY_SIZE;
        knownRoot[newRoot] = true;
        emit RootUpdated(newRoot);
    }

    function registerToken(address token) external onlyIssuer {
        if (registeredToken[token]) revert TokenAlreadyRegistered();
        registeredToken[token] = true;
        emit TokenRegistered(token);
    }

    /// @notice Self-admit msg.sender to `token`'s allowlist by proving membership in the
    ///         current (or a recent historical) Semaphore group root.
    /// @param token    RWA token contract the caller is admitting themselves to.
    /// @param root     Merkle root the proof was generated against.
    /// @param depth    Merkle tree depth used when proving.
    /// @param nullifier Nullifier output of the proof (scoped per token).
    /// @param points   The 8 Groth16 proof points (pA, pB, pC flattened).
    function admit(
        address token,
        uint256 root,
        uint256 depth,
        uint256 nullifier,
        uint256[8] calldata points
    ) external {
        if (!registeredToken[token]) revert TokenNotRegistered();
        if (depth < MIN_DEPTH || depth > MAX_DEPTH) revert DepthOutOfRange();
        if (!knownRoot[root]) revert UnknownRoot();
        if (usedNullifier[nullifier]) revert NullifierReused();

        // message = caller address (binds the proof to this specific on-chain identity)
        // scope   = token address (isolates nullifiers across tokens so the same group
        //           member can admit to multiple tokens)
        uint256 messageHash = _hashToField(uint256(uint160(msg.sender)));
        uint256 scopeHash = _hashToField(uint256(uint160(token)));

        bool ok = verifier.verifyProof(
            [points[0], points[1]],
            [[points[2], points[3]], [points[4], points[5]]],
            [points[6], points[7]],
            [root, nullifier, messageHash, scopeHash],
            depth
        );
        if (!ok) revert InvalidProof();

        usedNullifier[nullifier] = true;
        admitted[token][msg.sender] = true;
        emit Admitted(token, msg.sender, nullifier);
    }

    function isAdmitted(address token, address holder) external view returns (bool) {
        return admitted[token][holder];
    }

    /// @dev Matches Semaphore.sol's `_hash`: keccak256(message) >> 8, which shrinks a 256-bit
    ///      value into the ~248-bit BN254 scalar field.
    function _hashToField(uint256 value) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}
