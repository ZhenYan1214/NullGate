// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ComplianceGate} from "../src/ComplianceGate.sol";
import {PrivateRWA} from "../src/PrivateRWA.sol";
import {ISemaphoreVerifier} from "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

/// @dev A programmable verifier stub. We toggle the return value per-call so tests
///      can cover the happy and invalid-proof paths without needing real Groth16 data.
contract MockVerifier is ISemaphoreVerifier {
    bool public shouldAccept = true;

    function setAccept(bool v) external {
        shouldAccept = v;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[4] calldata,
        uint256
    ) external view returns (bool) {
        return shouldAccept;
    }
}

contract ComplianceGateTest is Test {
    MockVerifier internal verifier;
    ComplianceGate internal gate;
    PrivateRWA internal token;

    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal eve = makeAddr("eve");

    uint256 internal constant ROOT_A = 0x1111;
    uint256 internal constant ROOT_B = 0x2222;
    uint256 internal constant DEPTH = 20;

    function setUp() public {
        verifier = new MockVerifier();
        gate = new ComplianceGate(address(verifier), issuer);
        vm.prank(issuer);
        token = new PrivateRWA("HK Gov Bond 30", "HKGB30", address(gate), issuer);
        vm.prank(issuer);
        gate.registerToken(address(token));
        vm.prank(issuer);
        gate.updateRoot(ROOT_A);
    }

    function _points() internal pure returns (uint256[8] memory p) {
        for (uint256 i = 0; i < 8; i++) p[i] = i + 1;
    }

    function test_updateRoot_onlyIssuer() public {
        vm.expectRevert(ComplianceGate.NotIssuer.selector);
        gate.updateRoot(ROOT_B);

        vm.prank(issuer);
        gate.updateRoot(ROOT_B);
        assertEq(gate.currentRoot(), ROOT_B);
        assertTrue(gate.knownRoot(ROOT_A), "old root still recognised");
        assertTrue(gate.knownRoot(ROOT_B), "new root recognised");
    }

    function test_admit_happyPath() public {
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xdead, _points());
        assertTrue(gate.isAdmitted(address(token), alice));
    }

    function test_admit_rejectsReusedNullifier() public {
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xdead, _points());

        vm.prank(bob);
        vm.expectRevert(ComplianceGate.NullifierReused.selector);
        gate.admit(address(token), ROOT_A, DEPTH, 0xdead, _points());
    }

    function test_admit_rejectsUnknownRoot() public {
        vm.prank(alice);
        vm.expectRevert(ComplianceGate.UnknownRoot.selector);
        gate.admit(address(token), ROOT_B, DEPTH, 0xdead, _points());
    }

    function test_admit_rejectsInvalidProof() public {
        verifier.setAccept(false);
        vm.prank(alice);
        vm.expectRevert(ComplianceGate.InvalidProof.selector);
        gate.admit(address(token), ROOT_A, DEPTH, 0xdead, _points());
    }

    function test_admit_unregisteredToken() public {
        address fake = makeAddr("fake");
        vm.prank(alice);
        vm.expectRevert(ComplianceGate.TokenNotRegistered.selector);
        gate.admit(fake, ROOT_A, DEPTH, 0xdead, _points());
    }

    function test_admit_historicalRoot() public {
        vm.prank(issuer);
        gate.updateRoot(ROOT_B);
        assertEq(gate.currentRoot(), ROOT_B);

        // Alice generated her proof before the root updated — ROOT_A is still known.
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xbeef, _points());
        assertTrue(gate.isAdmitted(address(token), alice));
    }

    function test_transfer_requiresBothAdmitted() public {
        // Admit alice + bob, mint to alice.
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xaaaa, _points());
        vm.prank(bob);
        gate.admit(address(token), ROOT_A, DEPTH, 0xbbbb, _points());

        vm.prank(issuer);
        token.mint(alice, 1000e18);
        assertEq(token.balanceOf(alice), 1000e18);

        // alice -> bob: both admitted → succeeds.
        vm.prank(alice);
        token.transfer(bob, 100e18);
        assertEq(token.balanceOf(bob), 100e18);

        // alice -> eve: eve not admitted → reverts.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrivateRWA.NotAdmitted.selector, eve));
        token.transfer(eve, 50e18);
    }

    function test_mint_requiresRecipientAdmitted() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(PrivateRWA.NotAdmitted.selector, alice));
        token.mint(alice, 1000e18);
    }

    function test_mint_onlyIssuer() public {
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xaaaa, _points());

        vm.prank(eve);
        vm.expectRevert(PrivateRWA.NotIssuer.selector);
        token.mint(alice, 1000e18);
    }

    function test_burn_admittedHolder() public {
        vm.prank(alice);
        gate.admit(address(token), ROOT_A, DEPTH, 0xaaaa, _points());
        vm.prank(issuer);
        token.mint(alice, 500e18);

        vm.prank(alice);
        token.burn(200e18);
        assertEq(token.balanceOf(alice), 300e18);
    }

    function test_registerToken_onlyIssuer() public {
        address newTok = makeAddr("newTok");
        vm.expectRevert(ComplianceGate.NotIssuer.selector);
        gate.registerToken(newTok);
    }
}
