// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IEntryPoint {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

interface IAccountFactory {
    function validateOwnerSignature(
        address sender,
        bytes calldata data,
        bytes calldata signature
    ) external view returns (bool);
}

contract Account is Initializable {
    address public owner;
    address public immutable entryPoint;
    address public immutable factory;
    uint256 private _nonce;

    event AccountInitialized(address indexed owner);
    event UserOperationExecuted(bytes32 indexed userOpHash, bool success);

    constructor(address _entryPoint, address _factory) {
        entryPoint = _entryPoint;
        factory = _factory;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Only EntryPoint can call");
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        require(msg.sender == owner || msg.sender == entryPoint, "Only owner or EntryPoint");
        _;
    }

    function initialize(address _owner) external initializer {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
        emit AccountInitialized(_owner);
    }

    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        if (owner != userOp.sender) {
            return 1; // Invalid sender
        }

        // Validate signature using factory
        bool isValidSignature = IAccountFactory(factory).validateOwnerSignature(
            userOp.sender,
            abi.encode(userOpHash),
            userOp.signature
        );

        if (!isValidSignature) {
            return 1; // Invalid signature
        }

        // Pay missing account funds to EntryPoint
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(entryPoint).call{value: missingAccountFunds}("");
            require(success, "Failed to pay EntryPoint");
        }

        return 0; // Valid
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyEntryPoint {
        _call(dest, value, func);
    }

    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external onlyEntryPoint {
        require(dest.length == value.length && value.length == func.length, "Array length mismatch");
        
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }

    function getNonce() external view returns (uint256) {
        return _nonce;
    }

    function incrementNonce() external onlyOwnerOrEntryPoint {
        _nonce++;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // Allow receiving ETH
    receive() external payable {}
    
    fallback() external payable {}
}