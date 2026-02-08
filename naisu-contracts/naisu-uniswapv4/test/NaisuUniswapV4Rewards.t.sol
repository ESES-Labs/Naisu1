// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/NaisuUniswapV4Rewards.sol";
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
        // Return a default price if not set
        if (state.sqrtPriceX96 == 0) {
            return (79228162514264337593543950336, 0, 0, 0); // ~1.0
        }
        return (state.sqrtPriceX96, state.tick, 0, 0);
    }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external 
        returns (BalanceDelta, BalanceDelta) {
        // Return mock delta
        return (toBalanceDelta(0, 0), toBalanceDelta(0, 0));
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external 
        returns (BalanceDelta) {
        return toBalanceDelta(0, 0);
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

    // Other required interface functions
    function currencyDelta(address, Currency) external pure returns (int256) { return 0; }
    function getLiquidity(PoolId) external pure returns (uint128) { return 0; }
    function getPosition(PoolId, address, int24, int24, bytes32) external pure 
        returns (uint128, int256, int256, uint256, uint256, uint256, uint256) { 
        return (0, 0, 0, 0, 0, 0, 0); 
    }
}

/// @title NaisuUniswapV4RewardsTest
/// @notice Test suite for NaisuUniswapV4Rewards contract
contract NaisuUniswapV4RewardsTest is Test {
    using PoolIdLibrary for PoolKey;

    NaisuUniswapV4Rewards public rewardsContract;
    MockPoolManager public poolManager;
    MockERC20 public token0;
    MockERC20 public token1;

    address public owner = address(1);
    address public user = address(2);
    address public solver = address(3);

    uint256 constant INITIAL_BALANCE = 1000000e18;
    uint256 constant LIQUIDITY_AMOUNT = 10000e18;

    int24 constant TICK_LOWER = -120;
    int24 constant TICK_UPPER = 120;

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock tokens (ensure token0 < token1)
        token0 = new MockERC20("Token 0", "TK0", 18);
        token1 = new MockERC20("Token 1", "TK1", 18);

        // Deploy mock pool manager
        poolManager = new MockPoolManager();

        // Deploy rewards contract
        rewardsContract = new NaisuUniswapV4Rewards(address(poolManager), owner);

        // Add solver
        rewardsContract.addSolver(solver);

        // Mint tokens to user
        token0.mint(user, INITIAL_BALANCE);
        token1.mint(user, INITIAL_BALANCE);

        vm.stopPrank();

        // Approve tokens
        vm.startPrank(user);
        token0.approve(address(rewardsContract), type(uint256).max);
        token1.approve(address(rewardsContract), type(uint256).max);
        vm.stopPrank();
    }

    function test_AddLiquidity() public {
        vm.prank(user);

        uint128 liquidity = rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0 // minLiquidity
        );

        assertGt(liquidity, 0);

        // Check user position
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        INaisuRewards.Position memory position = rewardsContract.getUserPosition(user, poolId);
        assertEq(position.liquidity, liquidity);
    }

    function test_RevertWhen_InvalidTokenOrder() public {
        vm.prank(user);

        vm.expectRevert("Invalid token order");

        rewardsContract.addLiquidity(
            address(token1), // token1 > token0
            address(token0),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0
        );
    }

    function test_RevertWhen_ZeroAmounts() public {
        vm.prank(user);

        vm.expectRevert("Zero amounts");

        rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            0,
            0,
            TICK_LOWER,
            TICK_UPPER,
            0
        );
    }

    function test_RevertWhen_InvalidTickRange() public {
        vm.prank(user);

        vm.expectRevert("Invalid tick range");

        rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_UPPER, // reversed
            TICK_LOWER,
            0
        );
    }

    function test_RevertWhen_TicksOutOfBounds() public {
        vm.prank(user);

        vm.expectRevert("Ticks out of bounds");

        rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            -1000000, // Too low
            TICK_UPPER,
            0
        );
    }

    function test_RemoveLiquidity() public {
        vm.startPrank(user);

        // Add liquidity first
        uint128 liquidity = rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0
        );

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Remove half the liquidity
        (uint256 amount0, uint256 amount1) = rewardsContract.removeLiquidity(
            poolId,
            liquidity / 2,
            0,
            0
        );

        vm.stopPrank();

        // Check remaining position
        INaisuRewards.Position memory position = rewardsContract.getUserPosition(user, poolId);
        uint128 expectedRemaining = liquidity - (liquidity / 2);
        assertEq(position.liquidity, expectedRemaining);
    }

    function test_RevertWhen_PositionNotFound() public {
        vm.prank(user);

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        vm.expectRevert(
            abi.encodeWithSelector(
                NaisuUniswapV4Rewards.PositionNotFound.selector,
                user,
                poolId
            )
        );

        rewardsContract.removeLiquidity(
            poolId,
            1000,
            0,
            0
        );
    }

    function test_RevertWhen_InsufficientLiquidity() public {
        vm.startPrank(user);

        // Add liquidity
        uint128 liquidity = rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0
        );

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        // Try to remove more than available
        vm.expectRevert(
            abi.encodeWithSelector(
                NaisuUniswapV4Rewards.InsufficientLiquidity.selector,
                liquidity + 1,
                liquidity
            )
        );

        rewardsContract.removeLiquidity(
            poolId,
            liquidity + 1,
            0,
            0
        );

        vm.stopPrank();
    }

    function test_SolverAuthorization() public {
        // Check solver is authorized
        assertTrue(rewardsContract.authorizedSolvers(solver));

        // Remove solver
        vm.prank(owner);
        rewardsContract.removeSolver(solver);

        assertFalse(rewardsContract.authorizedSolvers(solver));

        // Re-add solver
        vm.prank(owner);
        rewardsContract.addSolver(solver);

        assertTrue(rewardsContract.authorizedSolvers(solver));
    }

    function test_RescueTokens() public {
        // Send some tokens to contract
        vm.prank(user);
        token0.transfer(address(rewardsContract), 1000e18);

        uint256 balanceBefore = token0.balanceOf(owner);

        // Rescue tokens
        vm.prank(owner);
        rewardsContract.rescueTokens(address(token0), 1000e18);

        uint256 balanceAfter = token0.balanceOf(owner);

        assertEq(balanceAfter - balanceBefore, 1000e18);
    }

    function test_GetPoolInfo() public {
        vm.prank(user);

        rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0
        );

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        INaisuRewards.PoolInfo memory info = rewardsContract.getPoolInfo(poolId);

        assertEq(info.token0, address(token0));
        assertEq(info.token1, address(token1));
        assertEq(info.fee, 3000);
        assertEq(info.tickSpacing, 60);
    }

    function test_CollectFees() public {
        vm.startPrank(user);

        rewardsContract.addLiquidity(
            address(token0),
            address(token1),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            TICK_LOWER,
            TICK_UPPER,
            0
        );
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        bytes32 poolId = PoolId.unwrap(poolKey.toId());

        (uint256 amount0, uint256 amount1) = rewardsContract.collectFees(poolId);

        vm.stopPrank();
        // With mock, fees might be 0, but function should execute
        assertEq(amount0, 0);
        assertEq(amount1, 0);
    }
}
