// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseScript} from "./base/BaseScript.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {LiquidityHelpers} from "./base/LiquidityHelpers.sol";
import {console} from "forge-std/console.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol"; 
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Permit2Deployer} from "hookmate/artifacts/Permit2.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";

contract RunAllScript is BaseScript, LiquidityHelpers {

    function run() external {
        address deployer = msg.sender;
        vm.startBroadcast(); // Start broadcasting immediately

        // 1. Deploy Environment (Tokens, Manager, Permit2, Router)
        // We call Deployers functions manually or rely on internal logic, but we must ensure we set the variables.
        
        // Deploy Tokens
        (currency0, currency1) = deployCurrencyPair();
        token0 = IERC20(Currency.unwrap(currency0));
        token1 = IERC20(Currency.unwrap(currency1));
        
        console.log("Token0:", address(token0));
        console.log("Token1:", address(token1));
        
        // Mint debugging
        console.log("Balance0:", token0.balanceOf(deployer));
        console.log("Balance1:", token1.balanceOf(deployer));
        
        console.log("Balance1:", token1.balanceOf(deployer));
        
        // Manual Permit2 Etch
        address p2 = AddressConstants.getPermit2Address();
        if (p2.code.length == 0) {
             console.log("Etching Permit2...");
             _etch(p2, Permit2Deployer.deploy().code);
        }
        
        // Deploy Artifacts
        deployArtifacts();
        
        // 2. Deploy Hook
        // Buffer scope issues - define vars
        address usdc = address(token1); 
        address liFiBridge = address(0); 
        
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

        uint160 startingPrice = 79228162514264337593543950336; 
        poolManager.initialize(poolKey, startingPrice);
        console.log("Pool Initialized");

        // 4. Add Liquidity
        // Approvals (re-approve to be sure)
        token0.approve(address(permit2), type(uint256).max);
        token1.approve(address(permit2), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        
        console.log("Allowance Token0->Permit2:", token0.allowance(deployer, address(permit2)));
        console.log("Deployer:", deployer);
        
        // Permit2 Approvals
        permit2.approve(address(token0), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token0), address(swapRouter), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(swapRouter), type(uint160).max, type(uint48).max);

        int24 tick = TickMath.getTickAtSqrtPrice(startingPrice);
        int24 tickLower = (tick / 60) * 60 - 120; 
        int24 tickUpper = (tick / 60) * 60 + 120;
        
        uint128 liquidity = 1000e18; 
        
        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey, tickLower, tickUpper, liquidity, 10_000 ether, 10_000 ether, deployer, new bytes(0)
        );
        positionManager.modifyLiquidities(abi.encode(actions, mintParams), block.timestamp + 300);
        console.log("Liquidity Added");

        // 5. Execute Swap
        console.log("Executing Swap...");
        
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef)); // Example Sui Addr
        uint8 strategyId = 1;
        address user = msg.sender; 

        bytes memory hookData = abi.encode(suiDest, strategyId, user);
        
        bool zeroForOne = true;
        // Check if token0 is WETH (input). Logic: swap token0 -> token1 (USDC)
        // If sorting made token0 USDC, we'd need to swap ZeroForOne=false.
        // But hook requires Output=USDC.
        // BaseScript sorts them. 'token0' is smaller address. 
        // We assume we mint both.
        // Let's force proper direction: Input = non-USDC.
        if (usdc == address(token0)) {
            zeroForOne = false; // Input is token1, Output is token0 (USDC)
        }

        swapRouter.swap(
            -1e18, // amountSpecified
            0,     // amountLimit
            zeroForOne,
            poolKey,
            hookData,
            user,  // receiver
            block.timestamp + 30 // deadline
        );
        
        console.log("Swap Complete! Event should be emitted.");
        console.log("User Address sent in event:", user);

        vm.stopBroadcast();
    }
}
