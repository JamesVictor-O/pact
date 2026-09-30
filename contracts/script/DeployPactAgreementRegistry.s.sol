// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script} from "forge-std/Script.sol";
import {PactAgreementRegistry} from "../src/PactAgreementRegistry.sol";
contract DeployPactAgreementRegistry is Script {
    function run() external returns (PactAgreementRegistry registry) {
        uint256 deployerKey = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        registry = new PactAgreementRegistry();
        vm.stopBroadcast();
    }
}
