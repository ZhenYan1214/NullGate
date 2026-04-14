// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {
    SemaphoreVerifier
} from "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import {ComplianceGate} from "../src/ComplianceGate.sol";
import {PrivateRWA} from "../src/PrivateRWA.sol";
import {MockKycSBT} from "../src/MockKycSBT.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("ISSUER_PRIVATE_KEY");
        address issuer = vm.addr(pk);

        vm.startBroadcast(pk);

        SemaphoreVerifier verifier = new SemaphoreVerifier();

        // MockKycSBT: demo-safe KYC contract. The issuer (deployer) can approve/revoke
        // any address via approve(). Replace with the real HashKey KYC SBT address
        // in production: https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC
        MockKycSBT mockKyc = new MockKycSBT();

        ComplianceGate gate = new ComplianceGate(
            address(verifier),
            issuer,
            address(mockKyc)
        );
        PrivateRWA rwa = new PrivateRWA(
            "ZK Compliant Bond",
            "ZKCB",
            address(gate),
            issuer
        );
        gate.registerToken(address(rwa));

        vm.stopBroadcast();

        console2.log("SemaphoreVerifier:", address(verifier));
        console2.log("MockKycSBT:       ", address(mockKyc));
        console2.log("ComplianceGate:   ", address(gate));
        console2.log("PrivateRWA:       ", address(rwa));
        console2.log("Issuer:           ", issuer);
    }
}
