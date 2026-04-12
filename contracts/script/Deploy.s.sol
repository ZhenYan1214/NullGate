// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SemaphoreVerifier} from "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import {ComplianceGate} from "../src/ComplianceGate.sol";
import {PrivateRWA} from "../src/PrivateRWA.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("ISSUER_PRIVATE_KEY");
        address issuer = vm.addr(pk);

        vm.startBroadcast(pk);

        SemaphoreVerifier verifier = new SemaphoreVerifier();
        ComplianceGate gate = new ComplianceGate(address(verifier), issuer);
        PrivateRWA rwa = new PrivateRWA("HashKey Gov Bond 2030", "HKGB30", address(gate), issuer);
        gate.registerToken(address(rwa));

        vm.stopBroadcast();

        console2.log("SemaphoreVerifier:", address(verifier));
        console2.log("ComplianceGate:   ", address(gate));
        console2.log("PrivateRWA:       ", address(rwa));
        console2.log("Issuer:           ", issuer);
    }
}
