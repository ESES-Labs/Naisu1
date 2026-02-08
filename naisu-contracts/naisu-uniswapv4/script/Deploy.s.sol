// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/NaisuUniswapV4Swap.sol";
import "../src/NaisuUniswapV4Rewards.sol";

/// @title DeployScript
/// @notice Deployment script for Naisu Uniswap V4 contracts
/// @dev Usage: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
contract DeployScript is Script {
    /// @notice PoolManager addresses by chain
    mapping(uint256 => address) public poolManagers;

    constructor() {
        // Ethereum Sepolia
        poolManagers[11155111] = 0xe8e4dB7F7fdac71179Cf2860d0f1bEfaF2b3C6d5;
        
        // Base Sepolia
        poolManagers[84532] = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
        
        // Ethereum Mainnet
        poolManagers[1] = address(0); // Update with mainnet address
        
        // Base Mainnetpoo
        poolManagers[8453] = address(0); // Update with mainnet address
    }

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        uint256 chainId = block.chainid;
        address poolManager = poolManagers[chainId];

        require(poolManager != address(0), "PoolManager not set for this chain");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying to chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("PoolManager:", poolManager);

        // Deploy Swap contract
        NaisuUniswapV4Swap swapContract = new NaisuUniswapV4Swap(
            poolManager,
            deployer
        );
        console.log("NaisuUniswapV4Swap deployed at:", address(swapContract));

        // Deploy Rewards contract
        NaisuUniswapV4Rewards rewardsContract = new NaisuUniswapV4Rewards(
            poolManager,
            deployer
        );
        console.log("NaisuUniswapV4Rewards deployed at:", address(rewardsContract));

        vm.stopBroadcast();

        // Log deployment info
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", chainId);
        console.log("PoolManager:", poolManager);
        console.log("NaisuUniswapV4Swap:", address(swapContract));
        console.log("NaisuUniswapV4Rewards:", address(rewardsContract));
        console.log("==========================\n");
    }
}
