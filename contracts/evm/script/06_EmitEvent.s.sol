// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MockEmitter} from "../src/mocks/MockEmitter.sol";

contract EmitEventScript is Script {
    function run() external {
        vm.startBroadcast();
        
        MockEmitter emitter = new MockEmitter();
        console.log("Emitter Address:", address(emitter));
        
        emitter.emitEvent();
        console.log("Event Emitted!");
        
        vm.stopBroadcast();
    }
}
