// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";

contract SwapOnlyScript is Script {
    // Deployed Addresses on Base Sepolia
    address constant TOKEN0 = 0x5D9eaE096BF641258Be58677885F303B4Ff96468;
    address constant TOKEN1 = 0x841132fF5a7cA93aE1Ad08Bdf44D08e59EDEDA28;
    address constant HOOK = 0xf0093fcf07aA10De35B78D1F33c60439D11bc0c0;
    address constant POOL_SWAP_TEST = 0x8B5bcC363ddE2614281aD875bad385E0A785D3B9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        console.log("Using Token0:", TOKEN0);
        console.log("Using Token1:", TOKEN1);
        console.log("Using Hook:", HOOK);

        MockERC20 token0 = MockERC20(TOKEN0);
        MockERC20 token1 = MockERC20(TOKEN1);
        
        // Ensure deployer has balance (mint if needed, but should have from previous run)
        // token0.mint(deployer, 10e18);
        // token1.mint(deployer, 10e18);

        PoolSwapTest poolSwapTest = PoolSwapTest(POOL_SWAP_TEST);

        // Approvals
        token0.approve(address(poolSwapTest), type(uint256).max);
        token1.approve(address(poolSwapTest), type(uint256).max);

        // Construct PoolKey
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(TOKEN0),
            currency1: Currency.wrap(TOKEN1),
            fee: 3000,
            tickSpacing: 60,
            hooks: NaisuIntentHook(HOOK)
        });

        // Swap Params
        bytes32 suiDest = bytes32(uint256(0xdeadbeef)); 
        uint8 strategyId = 2;
        address user = deployer; 

        bytes memory hookData = abi.encode(suiDest, strategyId, user);
        
        // Swap Token0 -> Token1 (ZeroForOne = true if token0 is input)
        // Assume Token0 is input
        bool zeroForOne = true;
        
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -0.1 ether, // Swap 0.1 tokens
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
        
        PoolSwapTest.TestSettings memory testSettings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        console.log("Swapping...");
        poolSwapTest.swap(
            poolKey,
            params,
            testSettings,
            hookData
        );
        console.log("Swap Complete!");

        vm.stopBroadcast();
    }
}
