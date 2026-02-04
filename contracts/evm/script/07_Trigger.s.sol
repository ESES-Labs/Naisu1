// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {MockEmitter} from "../src/mocks/MockEmitter.sol";

contract TriggerScript is Script {
    function run() external {
        vm.startBroadcast();
        MockEmitter(0x5FbDB2315678afecb367f032d93F642f64180aa3).emitEvent();
        vm.stopBroadcast();
    }
}
