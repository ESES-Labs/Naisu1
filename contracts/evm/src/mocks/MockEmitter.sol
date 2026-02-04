// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockEmitter {
    event IntentCreated(
        bytes32 indexed intentId,
        address indexed user,
        bytes32 suiDestination,
        address inputToken,
        uint256 inputAmount,
        uint256 usdcAmount,
        uint8 strategyId,
        uint256 timestamp
    );

    function emitEvent() external {
        bytes32 intentId = keccak256("test_intent");
        address user = msg.sender;
        bytes32 suiDest = bytes32(uint256(0xdeadbeef));
        address inputToken = address(0x123);
        uint256 inputAmount = 1e18;
        uint256 usdcAmount = 1e6;
        uint8 strategyId = 1;
        uint256 timestamp = block.timestamp;

        emit IntentCreated(
            intentId,
            user,
            suiDest,
            inputToken,
            inputAmount,
            usdcAmount,
            strategyId,
            timestamp
        );
    }
}
