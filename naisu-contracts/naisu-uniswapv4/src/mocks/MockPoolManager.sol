// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";

/// @title MockPoolManager
/// @notice Lightweight PoolManager mock for chains without Uniswap v4 deployments
/// @dev This is for demos only and does NOT implement real AMM math.
contract MockPoolManager {
    using PoolIdLibrary for PoolKey;

    struct PoolState {
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
    }

    struct PositionState {
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
    }

    mapping(PoolId => PoolState) public pools;
    mapping(bytes32 => PositionState) public positions;

    PoolId public lastPoolId;

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24) {
        PoolId poolId = key.toId();
        pools[poolId] = PoolState(sqrtPriceX96, 0, 0);
        lastPoolId = poolId;
        return 0;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata)
        external
        returns (BalanceDelta)
    {
        // Simple mock swap: returns 99% of input as output at a 1:1 price.
        int256 amountOut = params.amountSpecified * 99 / 100;

        int128 amount0;
        int128 amount1;
        if (params.zeroForOne) {
            amount0 = int128(-params.amountSpecified);
            amount1 = int128(amountOut);
        } else {
            amount1 = int128(-params.amountSpecified);
            amount0 = int128(amountOut);
        }

        return toBalanceDelta(amount0, amount1);
    }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata)
        external
        returns (BalanceDelta callerDelta, BalanceDelta feesAccrued)
    {
        PoolId poolId = key.toId();
        bytes32 positionKey = keccak256(
            abi.encode(poolId, params.tickLower, params.tickUpper, params.salt)
        );
        PositionState storage position = positions[positionKey];

        if (params.liquidityDelta > 0) {
            // Mock "deposit": take whatever balances the caller currently has.
            uint256 amount0 = _balanceOf(key.currency0, msg.sender);
            uint256 amount1 = _balanceOf(key.currency1, msg.sender);

            position.liquidity += uint128(uint256(params.liquidityDelta));
            position.amount0 += amount0;
            position.amount1 += amount1;

            callerDelta = toBalanceDelta(
                -int128(uint128(amount0)),
                -int128(uint128(amount1))
            );
            return (callerDelta, toBalanceDelta(0, 0));
        }

        if (params.liquidityDelta < 0) {
            uint128 delta = uint128(uint256(-params.liquidityDelta));
            if (position.liquidity == 0 || delta > position.liquidity) {
                return (toBalanceDelta(0, 0), toBalanceDelta(0, 0));
            }

            uint256 amount0 = (position.amount0 * delta) / position.liquidity;
            uint256 amount1 = (position.amount1 * delta) / position.liquidity;

            position.liquidity -= delta;
            position.amount0 -= amount0;
            position.amount1 -= amount1;

            callerDelta = toBalanceDelta(
                int128(uint128(amount0)),
                int128(uint128(amount1))
            );
            return (callerDelta, toBalanceDelta(0, 0));
        }

        // liquidityDelta == 0 (collect)
        return (toBalanceDelta(0, 0), toBalanceDelta(0, 0));
    }

    function sync(Currency) external {}

    function settle() external payable returns (uint256) {
        return 0;
    }

    function take(Currency currency, address to, uint256 amount) external {
        if (Currency.unwrap(currency) == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(Currency.unwrap(currency)).transfer(to, amount);
        }
    }

    function getSlot0(PoolId poolId) external view returns (uint160, int24, uint24, uint24) {
        PoolState storage state = pools[poolId];
        if (state.sqrtPriceX96 == 0) {
            return (79228162514264337593543950336, 0, 0, 0);
        }
        return (state.sqrtPriceX96, state.tick, 0, 0);
    }

    function extsload(bytes32) external view returns (bytes32) {
        return _slot0Bytes();
    }

    function extsload(bytes32, uint256 nSlots) external view returns (bytes32[] memory values) {
        values = new bytes32[](nSlots);
        bytes32 slot0 = _slot0Bytes();
        for (uint256 i = 0; i < nSlots; i++) {
            values[i] = slot0;
        }
    }

    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory values) {
        values = new bytes32[](slots.length);
        bytes32 slot0 = _slot0Bytes();
        for (uint256 i = 0; i < slots.length; i++) {
            values[i] = slot0;
        }
    }

    function _slot0Bytes() internal view returns (bytes32) {
        PoolState storage state = pools[lastPoolId];
        uint160 sqrtPriceX96 = state.sqrtPriceX96 == 0
            ? 79228162514264337593543950336
            : state.sqrtPriceX96;
        return _encodeSlot0(sqrtPriceX96, state.tick, 0, 0);
    }

    function _balanceOf(Currency currency, address owner) internal view returns (uint256) {
        if (Currency.unwrap(currency) == address(0)) {
            return owner.balance;
        }
        return IERC20(Currency.unwrap(currency)).balanceOf(owner);
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

    function toBalanceDelta(int128 amount0, int128 amount1) internal pure returns (BalanceDelta) {
        BalanceDelta balanceDelta;
        assembly ("memory-safe") {
            balanceDelta := or(shl(128, amount0), and(sub(shl(128, 1), 1), amount1))
        }
        return balanceDelta;
    }

    receive() external payable {}
}
