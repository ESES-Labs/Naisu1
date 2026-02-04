// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {NaisuIntentHook} from "../src/NaisuIntentHook.sol";

/// @notice Mines the address and deploys the NaisuIntentHook.sol Hook contract
contract DeployNaisuHookScript is Script {
    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // TODO: Update with actual Li.Fi bridge address on Base Sepolia
    address constant LIFI_BRIDGE = 0x0000000000000000000000000000000000000000;
    
    // Using CREATE2_FACTORY from forge-std Base.sol

    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(POOL_MANAGER, USDC, LIFI_BRIDGE);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(NaisuIntentHook).creationCode, constructorArgs);

        console.log("Mining hook address...");
        console.log("Expected address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // Deploy the hook using CREATE2
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        NaisuIntentHook hook = new NaisuIntentHook{salt: salt}(IPoolManager(POOL_MANAGER), USDC, LIFI_BRIDGE);
        vm.stopBroadcast();

        require(address(hook) == hookAddress, "DeployNaisuHookScript: Hook Address Mismatch");
        
        console.log("NaisuIntentHook deployed at:", address(hook));
    }
}
