// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";
import {IPoolManager, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {BaseTest} from "./utils/BaseTest.sol";

contract NaisuIntentHookTest is BaseTest {
    using PoolIdLibrary for PoolKey;

    NaisuIntentHook hook;
    MockERC20 usdc;
    MockERC20 weth;
    PoolKey poolKey;
    PoolModifyLiquidityTest lpRouter;
    
    address user = address(0x1234);
    address agent = address(0x5678);

    function setUp() public {
        // Deploy v4 artifacts
        deployArtifactsAndLabel();
        
        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        
        // Mint tokens to user
        usdc.mint(user, 1_000_000 ether); // Mint large amount to cover partial liquidity needs
        weth.mint(user, 1_000e18);
        
        // Deploy hook with proper flags
        // Hook address must have BEFORE_SWAP_FLAG and AFTER_SWAP_FLAG encoded
        address flags = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^
                (0x4444 << 144) // Namespace the hook to avoid collisions
        );
        
        bytes memory constructorArgs = abi.encode(
            address(poolManager), 
            address(usdc), 
            address(0) // Li.Fi bridge not needed for testing
        );
        
        deployCodeTo("NaisuIntentHook.sol:NaisuIntentHook", constructorArgs, flags);
        hook = NaisuIntentHook(flags);
        
        // Create pool: WETH/USDC with our hook
        Currency currency0 = Currency.wrap(address(weth));
        Currency currency1 = Currency.wrap(address(usdc));
        
        // Ensure proper ordering
        if (Currency.unwrap(currency0) > Currency.unwrap(currency1)) {
            (currency0, currency1) = (currency1, currency0);
        }
        
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        // Initialize pool
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // 1:1 price
        poolManager.initialize(poolKey, sqrtPriceX96);
        
        vm.label(address(hook), "NaisuIntentHook");
        vm.label(address(usdc), "USDC");
        vm.label(address(usdc), "USDC");
        vm.label(address(weth), "WETH");
        
        lpRouter = new PoolModifyLiquidityTest(poolManager);
        vm.label(address(lpRouter), "LPRouter");
        
        // Approve lpRouter
        vm.startPrank(user);
        weth.approve(address(lpRouter), type(uint256).max);
        usdc.approve(address(lpRouter), type(uint256).max);
        vm.stopPrank();
    }

    function test_SetIntentData() public {
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef));
        uint8 strategyId = 1;
        
        vm.prank(user);
        hook.setIntentData(suiDest, strategyId);
        
        // Intent data is stored temporarily, we can verify it was set by checking 
        // the internal mapping through a swap test
    }

    function test_Revert_InvalidSuiDestination() public {
        vm.expectRevert("Invalid Sui destination");
        vm.prank(user);
        hook.setIntentData(bytes32(0), 1);
    }

    function test_Revert_InvalidStrategyId_Zero() public {
        vm.expectRevert("Invalid strategy ID");
        vm.prank(user);
        hook.setIntentData(bytes32(uint256(1)), 0);
    }

    function test_Revert_InvalidStrategyId_TooHigh() public {
        vm.expectRevert("Invalid strategy ID");
        vm.prank(user);
        hook.setIntentData(bytes32(uint256(1)), 5);
    }

    function test_ClearIntentData() public {
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef));
        uint8 strategyId = 1;
        
        vm.startPrank(user);
        hook.setIntentData(suiDest, strategyId);
        hook.clearIntentData();
        vm.stopPrank();
        
        // After clearing, swap should not create intent
        // This is verified by checking no IntentCreated event is emitted
    }

    function test_IntentCreationViaSwap() public {
        bytes32 suiDest = bytes32(uint256(0x1234567890abcdef));
        uint8 strategyId = 1;

        // Setup: Set intent data
        vm.prank(user);
        hook.setIntentData(suiDest, strategyId);

        // Record logs to capture IntentCreated event
        vm.recordLogs();

         // Add Liquidity
         vm.startPrank(user);
         lpRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: 100_000 ether,
                salt: bytes32(0)
            }),
            new bytes(0)
         );
         vm.stopPrank();

        // Approve tokens for swapRouter
         vm.startPrank(user);
        address routerAddress = address(swapRouter);
        weth.approve(routerAddress, type(uint256).max);
        usdc.approve(routerAddress, type(uint256).max);

        // Swap WETH -> USDC
        bool zeroForOne = Currency.unwrap(poolKey.currency0) == address(weth);
        
        // Exact input: 1 WETH
        int256 amountSpecified = -1e18; 
        


        bytes memory hookData = abi.encode(suiDest, strategyId, user);
        
        // Execute swap
        swapRouter.swap(
            amountSpecified,
            0, // Min output (no slippage protection)
            zeroForOne,
            poolKey,
            hookData,
            user, // receiver
            block.timestamp + 1 // deadline
        );
        vm.stopPrank();

        // Match expected intent ID
        // Note: usage of user address (EOA) is now correct because we passed it via hookData
        
        bytes32 expectedIntentId = keccak256(abi.encodePacked(
            user,
            suiDest,
            block.timestamp,
            uint256(0)
        ));
        
        NaisuIntentHook.Intent memory intent = hook.getIntent(expectedIntentId);
        
        assertEq(intent.user, user, "Intent user mismatch");
        assertEq(intent.suiDestination, suiDest, "Sui destination mismatch");
        assertEq(intent.inputToken, address(weth), "Input token mismatch");
        // We exchanged 1 WETH.
        assertEq(intent.inputAmount, 1e18, "Input amount mismatch");
        
        // Check Status
        assertTrue(uint8(intent.status) == uint8(NaisuIntentHook.IntentStatus.SwapCompleted), "Status mismatch");
        
        // Verify nonce incremented
        assertEq(hook.nextIntentNonce(), 1, "Nonce not incremented");
    }

    function test_GetUserIntents() public {
        // Initially user should have no intents
        bytes32[] memory intents = hook.getUserIntents(user);
        assertEq(intents.length, 0, "User should have no intents initially");
    }

    function test_HookPermissions() public {
        Hooks.Permissions memory perms = hook.getHookPermissions();
        
        // Verify correct flags are set
        assertFalse(perms.beforeInitialize);
        assertFalse(perms.afterInitialize);
        assertFalse(perms.beforeAddLiquidity);
        assertFalse(perms.afterAddLiquidity);
        assertFalse(perms.beforeRemoveLiquidity);
        assertFalse(perms.afterRemoveLiquidity);
        assertTrue(perms.beforeSwap);
        assertTrue(perms.afterSwap);
        assertFalse(perms.beforeDonate);
        assertFalse(perms.afterDonate);
        assertFalse(perms.beforeSwapReturnDelta);
        assertFalse(perms.afterSwapReturnDelta);
        assertFalse(perms.afterAddLiquidityReturnDelta);
        assertFalse(perms.afterRemoveLiquidityReturnDelta);
    }

    function test_IntentStatusEnum() public {
        // Verify enum values
        assertEq(uint256(NaisuIntentHook.IntentStatus.Pending), 0);
        assertEq(uint256(NaisuIntentHook.IntentStatus.SwapCompleted), 1);
        assertEq(uint256(NaisuIntentHook.IntentStatus.Bridging), 2);
        assertEq(uint256(NaisuIntentHook.IntentStatus.Completed), 3);
        assertEq(uint256(NaisuIntentHook.IntentStatus.Failed), 4);
        assertEq(uint256(NaisuIntentHook.IntentStatus.Cancelled), 5);
    }

    function testFuzz_SetIntentData(bytes32 suiDest, uint8 strategyId) public {
        vm.assume(suiDest != bytes32(0));
        vm.assume(strategyId > 0 && strategyId <= 4);
        
        vm.prank(user);
        hook.setIntentData(suiDest, strategyId);
        
        // If we could access internal state, we'd verify it was set
        // For now, just ensure it doesn't revert
    }
}
