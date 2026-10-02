// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PactEventVaultFactory} from "../src/PactEventVaultFactory.sol";

contract DeployPactEventVaultFactory is Script {
    function run() external returns (PactEventVaultFactory factory) {
        uint256 key = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        address registry = vm.envAddress("PACT_AGREEMENT_REGISTRY_ADDRESS");
        address token = vm.envAddress("PACT_SETTLEMENT_TOKEN_ADDRESS");
        vm.startBroadcast(key);
        factory = new PactEventVaultFactory(registry, token);
        vm.stopBroadcast();
    }
}
