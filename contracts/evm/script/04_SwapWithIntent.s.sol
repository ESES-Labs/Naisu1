// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BaseScript} from "./base/BaseScript.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract SwapWithIntentScript is BaseScript {
    function run() external {
        // Construct the pool key (must match deployed pool)
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hookContract
        });
        
        // --- Intent Data ---
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef)); // Example Sui Address
        uint8 strategyId = 1;
        address user = getDeployer(); 
        
        bytes memory hookData = abi.encode(suiDest, strategyId, user);

        vm.startBroadcast();

        // Approvals
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);

        // Execute Swap
        // We swap 1 unit of token0 (WETH) -> token1 (USDC)
        // Ensure we are swapping the input token
        bool zeroForOne = true; 
        
        // amountSpecified: negative for exact input
        int256 amountSpecified = -1e18;

        swapRouter.swap(
            amountSpecified,
            0, // Min output (no slippage protection)
            zeroForOne,
            poolKey,
            hookData,
            user, // receiver
            block.timestamp + 30 // deadline
        );

        vm.stopBroadcast();
    }
}
