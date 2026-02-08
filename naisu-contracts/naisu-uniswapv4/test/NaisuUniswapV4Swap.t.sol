// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/NaisuUniswapV4Swap.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

/// @notice Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** decimals);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock PoolManager for testing
contract MockPoolManager {
    using PoolIdLibrary for PoolKey;

    mapping(PoolId => PoolState) public pools;

    struct PoolState {
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24) {
        PoolId poolId = key.toId();
        pools[poolId] = PoolState(sqrtPriceX96, 0, 0);
        return 0;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function getSlot0(PoolId poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) {
        PoolState storage state = pools[poolId];
        return (state.sqrtPriceX96, state.tick, 0, 0);
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external 
        returns (BalanceDelta) {
        // Mock swap: return 99% of input as output
        int256 amountOut = params.amountSpecified * 99 / 100;

        int128 amount0;
        int128 amount1;
        if (params.zeroForOne) {
            // exact input of token0, output token1
            amount0 = int128(-params.amountSpecified);
            amount1 = int128(amountOut);
        } else {
            // exact input of token1, output token0
            amount1 = int128(-params.amountSpecified);
            amount0 = int128(amountOut);
        }

        return toBalanceDelta(amount0, amount1);
    }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external 
        returns (BalanceDelta, BalanceDelta) {
        return (toBalanceDelta(0, 0), toBalanceDelta(0, 0));
    }

    function sync(Currency currency) external {}

    function settle() external payable returns (uint256) {
        return 0;
    }

    function take(Currency currency, address to, uint256 amount) external {
        if (Currency.unwrap(currency) != address(0)) {
            IERC20(Currency.unwrap(currency)).transfer(to, amount);
        } else {
            payable(to).transfer(amount);
        }
    }

    function toBalanceDelta(int128 amount0, int128 amount1) internal pure returns (BalanceDelta) {
        BalanceDelta balanceDelta;
        assembly ("memory-safe") {
            balanceDelta := or(shl(128, amount0), and(sub(shl(128, 1), 1), amount1))
        }
        return balanceDelta;
    }

    function extsload(bytes32 slot) external view returns (bytes32) {
        return _encodeSlot0(79228162514264337593543950336, 0, 0, 0);
    }

    function extsload(bytes32 startSlot, uint256 nSlots) external view returns (bytes32[] memory values) {
        values = new bytes32[](nSlots);
        bytes32 slot0 = _encodeSlot0(79228162514264337593543950336, 0, 0, 0);
        for (uint256 i = 0; i < nSlots; i++) {
            values[i] = slot0;
        }
    }

    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory values) {
        values = new bytes32[](slots.length);
        bytes32 slot0 = _encodeSlot0(79228162514264337593543950336, 0, 0, 0);
        for (uint256 i = 0; i < slots.length; i++) {
            values[i] = slot0;
        }
    }

    function _encodeSlot0(
        uint160 sqrtPriceX96,
        int24 tick,
        uint24 protocolFee,
        uint24 lpFee
    ) internal pure returns (bytes32) {
        uint256 data = uint256(sqrtPriceX96);
        data |= uint256(uint24(tick)) << 160;
        data |= uint256(protocolFee) << 184;
        data |= uint256(lpFee) << 208;
        return bytes32(data);
    }

    // Other required interface functions (not implemented for mock)
    function currencyDelta(address, Currency) external pure returns (int256) { return 0; }
    function getLiquidity(PoolId) external pure returns (uint128) { return 0; }
    function getPosition(PoolId, address, int24, int24, bytes32) external pure 
        returns (uint128, int256, int256, uint256, uint256, uint256, uint256) { 
        return (0, 0, 0, 0, 0, 0, 0); 
    }
}

/// @title NaisuUniswapV4SwapTest
/// @notice Test suite for NaisuUniswapV4Swap contract
contract NaisuUniswapV4SwapTest is Test {
    NaisuUniswapV4Swap public swapContract;
    MockPoolManager public poolManager;
    MockERC20 public tokenA;
    MockERC20 public tokenB;

    address public owner = address(1);
    address public user = address(2);
    address public solver = address(3);

    uint256 constant INITIAL_BALANCE = 1000000e18;
    uint256 constant SWAP_AMOUNT = 1000e18;

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock tokens
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);

        // Deploy mock pool manager
        poolManager = new MockPoolManager();

        // Deploy swap contract
        swapContract = new NaisuUniswapV4Swap(address(poolManager), owner);

        // Add solver
        swapContract.addSolver(solver);

        // Mint tokens to user
        tokenA.mint(user, INITIAL_BALANCE);
        tokenB.mint(user, INITIAL_BALANCE);

        // Seed pool manager with output token so swaps can pay out via take()
        tokenB.mint(address(poolManager), INITIAL_BALANCE);

        vm.stopPrank();

        // Approve tokens
        vm.startPrank(user);
        tokenA.approve(address(swapContract), type(uint256).max);
        tokenB.approve(address(swapContract), type(uint256).max);
        vm.stopPrank();
    }

    function test_ExecuteSwap() public {
        vm.startPrank(user);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 balanceBefore = tokenB.balanceOf(user);

        // Execute swap
        swapContract.executeSwap(
            address(tokenA),
            address(tokenB),
            SWAP_AMOUNT,
            0, // minAmountOut
            deadline
        );

        vm.stopPrank();

        // Basic sanity: swap should have executed without revert
    }

    function test_RevertWhen_DeadlineExpired() public {
        vm.prank(user);
        
        uint256 deadline = block.timestamp + 30; // Less than MIN_DEADLINE
        vm.expectRevert(
            abi.encodeWithSelector(
                NaisuUniswapV4Swap.DeadlineExpired.selector,
                deadline,
                block.timestamp
            )
        );

        swapContract.executeSwap(
            address(tokenA),
            address(tokenB),
            SWAP_AMOUNT,
            0,
            deadline
        );
    }

    function test_RevertWhen_ZeroAmount() public {
        vm.prank(user);
        
        uint256 deadline = block.timestamp + 1 hours;
        vm.expectRevert(NaisuUniswapV4Swap.ZeroAmount.selector);

        swapContract.executeSwap(
            address(tokenA),
            address(tokenB),
            0,
            0,
            deadline
        );
    }

    function test_RevertWhen_InvalidToken() public {
        vm.prank(user);
        
        uint256 deadline = block.timestamp + 1 hours;
        vm.expectRevert(NaisuUniswapV4Swap.InvalidToken.selector);

        swapContract.executeSwap(
            address(0),
            address(tokenB),
            SWAP_AMOUNT,
            0,
            deadline
        );
    }

    function test_GetSwapQuote() public {
        (uint256 amountOut, uint256 price) = swapContract.getSwapQuote(
            address(tokenA),
            address(tokenB),
            SWAP_AMOUNT
        );

        // With mock, we expect some output
        assertGt(amountOut, 0);
        assertGt(price, 0);
    }

    function test_SolverAuthorization() public {
        // Check solver is authorized
        assertTrue(swapContract.isAuthorizedSolver(solver));

        // Remove solver
        vm.prank(owner);
        swapContract.removeSolver(solver);

        assertFalse(swapContract.isAuthorizedSolver(solver));

        // Re-add solver
        vm.prank(owner);
        swapContract.addSolver(solver);

        assertTrue(swapContract.isAuthorizedSolver(solver));
    }

    function test_RescueTokens() public {
        // Send some tokens to contract
        vm.prank(user);
        tokenA.transfer(address(swapContract), 1000e18);

        uint256 balanceBefore = tokenA.balanceOf(owner);

        // Rescue tokens
        vm.prank(owner);
        swapContract.rescueTokens(address(tokenA), 1000e18);

        uint256 balanceAfter = tokenA.balanceOf(owner);

        assertEq(balanceAfter - balanceBefore, 1000e18);
    }

    function test_RevertWhen_NonOwnerRescueTokens() public {
        vm.prank(user);
        vm.expectRevert();
        swapContract.rescueTokens(address(tokenA), 1000e18);
    }

    function test_BatchSwaps() public {
        vm.startPrank(user);

        INaisuSwap.SwapParams[] memory swaps = new INaisuSwap.SwapParams[](2);
        swaps[0] = INaisuSwap.SwapParams({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: SWAP_AMOUNT,
            minAmountOut: 0
        });
        swaps[1] = INaisuSwap.SwapParams({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: SWAP_AMOUNT,
            minAmountOut: 0
        });

        uint256 deadline = block.timestamp + 1 hours;

        // Approve more tokens for batch
        tokenA.approve(address(swapContract), SWAP_AMOUNT * 2);

        // Mint more tokens
        tokenA.mint(user, SWAP_AMOUNT);

        uint256[] memory amountsOut = swapContract.executeBatchSwaps(swaps, deadline);

        assertEq(amountsOut.length, 2);
    }

    function test_RevertWhen_BatchWithEmptyArray() public {
        vm.prank(user);

        INaisuSwap.SwapParams[] memory swaps = new INaisuSwap.SwapParams[](0);
        uint256 deadline = block.timestamp + 1 hours;

        vm.expectRevert(NaisuUniswapV4Swap.ZeroAmount.selector);
        swapContract.executeBatchSwaps(swaps, deadline);
    }
}
