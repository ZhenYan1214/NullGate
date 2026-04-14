// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title MockKycSBT
/// @notice Demo-only replacement for the HashKey KYC SBT contract.
///         Implements the same isHuman() interface so ComplianceGate works
///         identically whether connected to the real HashKey KYC contract or this mock.
///         The deployer (issuer) can approve / revoke any address — useful for
///         showing both the KYC-pass and KYC-fail scenarios during a pitch.
///
/// @dev PRODUCTION NOTE: Replace the mock address in your .env with the real
///      HashKey KYC SBT address once your wallets have passed real KYC.
///      Real contract: https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC
contract MockKycSBT {
    address public immutable owner;
    mapping(address => bool) public approved;

    event Approved(address indexed user);
    event Revoked(address indexed user);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "MockKycSBT: not owner");
        _;
    }

    /// @notice Mark an address as KYC-verified (simulates HashKey KYC approval).
    function approve(address user) external onlyOwner {
        approved[user] = true;
        emit Approved(user);
    }

    /// @notice Remove KYC approval (simulates HashKey KYC revocation).
    function revoke(address user) external onlyOwner {
        approved[user] = false;
        emit Revoked(user);
    }

    /// @notice Matches HashKey KYC SBT interface exactly.
    ///         Returns (true, 1 = BASIC) if approved, (false, 0) otherwise.
    function isHuman(address user) external view returns (bool, uint8) {
        return approved[user] ? (true, 1) : (false, 0);
    }
}
