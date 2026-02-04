// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

/// @notice Script to interact with NaisuIntentHook
/// Full flow: Set Intent -> Check Intent Created
contract InteractWithHookScript is Script {
    using PoolIdLibrary for PoolKey;

    // Base Sepolia addresses
    address constant HOOK = 0x006a8462E9068B4012Db67f19076912E0a4740C0;
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant POSITION_MANAGER = 0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80;

    NaisuIntentHook hook = NaisuIntentHook(HOOK);
    IPoolManager poolManager = IPoolManager(POOL_MANAGER);
    IPositionManager posm = IPositionManager(POSITION_MANAGER);

    function run() public {
        address user = vm.addr(vm.envUint("PRIVATE_KEY"));
        console.log("Testing with user:", user);

        // 1. Check hook info
        console.log("\n=== 1. HOOK INFO ===");
        console.log("Hook address:", HOOK);
        console.log("USDC address:", USDC);
        
        // 2. Set Intent Data
        console.log("\n=== 2. SET INTENT DATA ===");
        bytes32 suiDestination = bytes32(uint256(uint160(0x1234567890abcdef)));
        uint8 strategyId = 1; // Scallop USDC
        
        vm.startBroadcast();
        hook.setIntentData(suiDestination, strategyId);
        vm.stopBroadcast();
        
        console.log("Sui Destination set to:", vm.toString(suiDestination));
        console.log("Strategy ID:", strategyId);
        
        // 3. Check user's intents
        console.log("\n=== 3. CHECK USER INTENTS ===");
        bytes32[] memory intents = hook.getUserIntents(user);
        console.log("User intent count:", intents.length);
        
        if (intents.length > 0) {
            console.log("Latest intent ID:", vm.toString(intents[intents.length - 1]));
            
            NaisuIntentHook.Intent memory intent = hook.getIntent(intents[intents.length - 1]);
            console.log("Intent user:", intent.user);
            console.log("Intent status:", uint256(intent.status));
            console.log("Intent strategyId:", intent.strategyId);
        }
        
        // 4. Test error cases
        console.log("\n=== 4. TEST INVALID INPUTS ===");
        
        // This should revert - invalid Sui destination
        try hook.setIntentData(bytes32(0), 1) {
            console.log("ERROR: Should have reverted for invalid Sui dest!");
        } catch {
            console.log("PASS: Correctly rejected invalid Sui destination");
        }
        
        // This should revert - invalid strategy ID
        try hook.setIntentData(bytes32(uint256(1)), 0) {
            console.log("ERROR: Should have reverted for invalid strategy!");
        } catch {
            console.log("PASS: Correctly rejected invalid strategy ID");
        }
        
        // 5. Clear intent data
        console.log("\n=== 5. CLEAR INTENT DATA ===");
        vm.startBroadcast();
        hook.clearIntentData();
        vm.stopBroadcast();
        console.log("Intent data cleared");
        
        console.log("\n=== INTERACTION COMPLETE ===");
    }
}
