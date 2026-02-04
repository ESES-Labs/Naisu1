// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseScript} from "./base/BaseScript.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityHelpers} from "./base/LiquidityHelpers.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

contract BaseSepoliaRunScript is BaseScript, LiquidityHelpers {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Environment (Tokens)
        // Explicitly deploy in run() to avoid simulation artifacts
        (currency0, currency1) = deployCurrencyPair();
        token0 = IERC20(Currency.unwrap(currency0));
        token1 = IERC20(Currency.unwrap(currency1));

        console.log("Deployer:", deployer);
        console.log("Token0:", address(token0));
        console.log("Token1:", address(token1));
        
        // Explicitly mint to deployer to ensure balance (fix constructor ownership issue)
        MockERC20(address(token0)).mint(deployer, 100_000 ether);
        MockERC20(address(token1)).mint(deployer, 100_000 ether);
        
        // 2. Deploy Hook
        address usdc = address(token1); 
        address liFiBridge = address(0); // Still mock bridge for now
        
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        bytes memory constructorArgs = abi.encode(address(poolManager), usdc, liFiBridge);
        
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(NaisuIntentHook).creationCode, constructorArgs);

        NaisuIntentHook hook = new NaisuIntentHook{salt: salt}(poolManager, usdc, liFiBridge);
        require(address(hook) == hookAddress, "Hook address mismatch");
        
        hookContract = hook;
        console.log("Hook Deployed at:", address(hook));

        // 3. Init Pool
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: hookContract
        });

        // 1:1 Price
        uint160 startingPrice = 79228162514264337593543950336; 
        
        // Check if pool already initialized? (Hooks might allow re-init check, but V4 pool man will revert)
        // Assuming fresh hook = fresh pool key.
        
        poolManager.initialize(poolKey, startingPrice);
        console.log("Pool Initialized");

        // 4. Add Liquidity
        // Approvals (Permit2 & Router)
        // Tokens are owned by deployer (because we minted to msg.sender in Deployers.sol)
        
        token0.approve(address(permit2), type(uint256).max);
        token1.approve(address(permit2), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        
        permit2.approve(address(token0), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token0), address(swapRouter), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(swapRouter), type(uint160).max, type(uint48).max);

        int24 tick = TickMath.getTickAtSqrtPrice(startingPrice);
        int24 tickLower = (tick / 60) * 60 - 120; 
        int24 tickUpper = (tick / 60) * 60 + 120;
        
        // Add 1000 units liquidity
        uint128 liquidity = 1000e18; 
        
        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey, tickLower, tickUpper, liquidity, 10_000 ether, 10_000 ether, deployer, new bytes(0)
        );
        positionManager.modifyLiquidities(abi.encode(actions, mintParams), block.timestamp + 300);
        console.log("Liquidity Added");

        // Approvals for PoolSwapTest
        address pstAddress = 0x8B5bcC363ddE2614281aD875bad385E0A785D3B9;
        PoolSwapTest poolSwapTest = PoolSwapTest(pstAddress);
        
        token0.approve(address(poolSwapTest), type(uint256).max);
        token1.approve(address(poolSwapTest), type(uint256).max);
        
        console.log("Executing Swap with PoolSwapTest...");
        
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef)); 
        uint8 strategyId = 1;
        address user = deployer; 

        bytes memory hookData = abi.encode(suiDest, strategyId, user);
        
        bool zeroForOne = true;
        if (usdc == address(token0)) {
            zeroForOne = false;
        }
        
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -1e18,
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
        
        PoolSwapTest.TestSettings memory testSettings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

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
