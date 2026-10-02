// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PactTreasury} from "../src/PactTreasury.sol";

contract DeployPactTreasury is Script {
    function run() external returns (PactTreasury treasury) {
        uint256 key = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        address registry = vm.envAddress("PACT_AGREEMENT_REGISTRY_ADDRESS");
        address token = vm.envAddress("PACT_SETTLEMENT_TOKEN_ADDRESS");
        vm.startBroadcast(key);
        treasury = new PactTreasury(registry, token);
        vm.stopBroadcast();
    }
}
