// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

/// @title CreatePoolScript
/// @notice Script to create Uniswap V4 pools
/// @dev Usage: forge script script/CreatePool.s.sol --rpc-url <RPC_URL> --broadcast
contract CreatePoolScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load from environment
        address poolManager = vm.envAddress("POOL_MANAGER");
        address token0 = vm.envAddress("TOKEN_0");
        address token1 = vm.envAddress("TOKEN_1");
        uint24 fee = uint24(vm.envUint("POOL_FEE"));
        int24 tickSpacing = int24(vm.envInt("TICK_SPACING"));
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));

        require(token0 < token1, "Token0 must be less than Token1");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Creating pool on PoolManager:", poolManager);
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("Fee:", fee);
        console.log("TickSpacing:", tickSpacing);

        // Create pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });

        // Initialize pool
        int24 tick = IPoolManager(poolManager).initialize(poolKey, sqrtPriceX96);

        vm.stopBroadcast();

        console.log("Pool created successfully!");
        console.log("Initial tick:", tick);
    }
}
