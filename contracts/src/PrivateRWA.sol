// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ComplianceGate} from "./ComplianceGate.sol";

/// @title PrivateRWA
/// @notice ERC-20 whose transfers require both parties to have self-admitted via a
///         ComplianceGate. The allowlist itself lives off-chain as a Semaphore group;
///         only post-admission addresses are publicly linkable to holdings.
contract PrivateRWA is ERC20 {
    error NotIssuer();
    error NotAdmitted(address who);

    ComplianceGate public immutable gate;
    address public immutable issuer;

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor(string memory name_, string memory symbol_, address gateAddr, address issuer_)
        ERC20(name_, symbol_)
    {
        gate = ComplianceGate(gateAddr);
        issuer = issuer_;
    }

    function mint(address to, uint256 amount) external onlyIssuer {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Mints skip the sender check; burns skip the recipient check.
        if (from != address(0) && !gate.isAdmitted(address(this), from)) {
            revert NotAdmitted(from);
        }
        if (to != address(0) && !gate.isAdmitted(address(this), to)) {
            revert NotAdmitted(to);
        }
        super._update(from, to, value);
    }
}
