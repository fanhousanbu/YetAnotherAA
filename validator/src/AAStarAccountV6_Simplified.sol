// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./AAStarValidator.sol";

interface IAccount {
    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external returns (uint256 validationData);
}

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

interface IEntryPoint {
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AAStarAccountV6_Simplified
 * @dev 简化版本：BLS和ECDSA都直接对userOpHash签名
 */
contract AAStarAccountV6_Simplified is IAccount, UUPSUpgradeable, Initializable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Account owner (for ECDSA validation part)
    address public owner;
    
    // AAStarValidator contract for BLS aggregate signature validation
    AAStarValidator public aaStarValidator;
    
    // Flag to enable/disable AAStarValidator
    bool public useAAStarValidator;

    IEntryPoint private immutable _entryPoint;

    // Events
    event AccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);
    event AAStarValidatorSet(address indexed validator, bool useCustom);
    event AAStarValidationUsed(address indexed validator, bool success);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner || msg.sender == address(this), "account: not Owner or self");
    }

    /**
     * @dev Initialize account with owner and AAStarValidator
     */
    function initialize(
        address anOwner,
        address _aaStarValidator,
        bool _useAAStarValidator
    ) public virtual initializer {
        _initialize(anOwner, _aaStarValidator, _useAAStarValidator);
    }

    /**
     * @dev Initialize with just owner (backward compatibility)
     */
    function initialize(address anOwner) public virtual initializer {
        _initialize(anOwner, address(0), false);
    }

    function _initialize(
        address anOwner,
        address _aaStarValidator,
        bool _useAAStarValidator
    ) internal virtual {
        owner = anOwner;
        
        if (_aaStarValidator != address(0)) {
            aaStarValidator = AAStarValidator(_aaStarValidator);
            useAAStarValidator = _useAAStarValidator;
            emit AAStarValidatorSet(_aaStarValidator, _useAAStarValidator);
        }
        
        emit AccountInitialized(_entryPoint, owner);
    }

    /**
     * @dev Set AAStarValidator
     */
    function setAAStarValidator(
        address _aaStarValidator,
        bool _useAAStarValidator
    ) external onlyOwner {
        if (_aaStarValidator != address(0)) {
            aaStarValidator = AAStarValidator(_aaStarValidator);
        }
        useAAStarValidator = _useAAStarValidator;
        emit AAStarValidatorSet(_aaStarValidator, _useAAStarValidator);
    }

    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    function executeBatch(address[] calldata dest, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    function entryPoint() public view virtual returns (IEntryPoint) {
        return _entryPoint;
    }

    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external virtual override returns (uint256 validationData) {
        _requireFromEntryPoint();
        validationData = _validateSignature(userOp, userOpHash);
        _validateNonce(userOp.nonce);
        _payPrefund(missingAccountFunds);
    }

    /**
     * @dev 简化的签名验证：BLS和ECDSA都直接对userOpHash签名
     * 签名格式: [nodeIds][blsSignature][aaSignature]
     */
    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
        internal returns (uint256 validationData) {
        
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        
        // Use AAStarValidator if enabled and available
        if (useAAStarValidator && address(aaStarValidator) != address(0)) {
            try this._parseAndValidateAAStarSignature(userOp.signature, userOpHash) 
                returns (bool isValid) {
                emit AAStarValidationUsed(address(aaStarValidator), isValid);
                return isValid ? 0 : 1;
            } catch {
                emit AAStarValidationUsed(address(aaStarValidator), false);
                // Fall back to default ECDSA validation if AAStarValidator fails
            }
        }
        
        // Default ECDSA validation
        if (owner != hash.recover(userOp.signature)) {
            return 1;
        }
        return 0;
    }

    /**
     * @dev 简化的AAStarValidator签名验证
     */
    function _parseAndValidateAAStarSignature(
        bytes calldata signature,
        bytes32 userOpHash
    ) external view returns (bool isValid) {
        require(msg.sender == address(this), "Only self can call");
        
        // Parse signature components
        (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory aaSignature
        ) = _parseAAStarSignature(signature);
        
        // 简化版验证：跳过BLS验证，只验证ECDSA签名
        // 这是一个临时简化方案，只验证ECDSA部分
        
        // ECDSA验证：直接对userOpHash签名
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, aaSignature);
        
        // 验证ECDSA签名是否来自账户所有者
        if (recoveredSigner != owner) {
            return false;
        }
        
        // 临时方案：假设BLS验证通过（需要后续实现BLS验证逻辑）
        // TODO: 实现BLS签名验证
        return true;
    }

    /**
     * @dev Parse AAStarValidator signature format
     * Format: [nodeIdsLength(32)][nodeIds...][blsSignature(256)][aaSignature(65)]
     */
    function _parseAAStarSignature(bytes calldata signature) 
        internal 
        pure 
        returns (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory aaSignature
        ) 
    {
        require(signature.length >= 32 + 256 + 65, "Invalid signature length");
        
        // Parse nodeIds length
        uint256 nodeIdsLength = abi.decode(signature[0:32], (uint256));
        require(nodeIdsLength > 0 && nodeIdsLength <= 100, "Invalid nodeIds length");
        
        uint256 nodeIdsDataLength = nodeIdsLength * 32;
        require(signature.length >= 32 + nodeIdsDataLength + 256 + 65, "Signature too short");
        
        // Parse nodeIds array
        nodeIds = new bytes32[](nodeIdsLength);
        for (uint256 i = 0; i < nodeIdsLength; i++) {
            uint256 offset = 32 + i * 32;
            nodeIds[i] = bytes32(signature[offset:offset + 32]);
        }
        
        // Parse other components
        uint256 blsOffset = 32 + nodeIdsDataLength;
        uint256 aaOffset = blsOffset + 256;
        
        blsSignature = signature[blsOffset:aaOffset];
        aaSignature = signature[aaOffset:aaOffset + 65];
    }

    /**
     * @dev Get current validation mode and validator
     */
    function getValidationConfig() external view returns (
        address validator,
        bool isAAStarEnabled,
        address accountOwner
    ) {
        return (address(aaStarValidator), useAAStarValidator, owner);
    }

    function _validateNonce(uint256) internal view virtual {
        // no-op
    }

    function _payPrefund(uint256 missingAccountFunds) internal virtual {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds, gas: type(uint256).max}("");
            (success);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function _requireFromEntryPoint() internal view virtual {
        require(msg.sender == address(entryPoint()), "account: not from EntryPoint");
    }

    function _requireFromEntryPointOrOwner() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == owner, "account: not Owner or EntryPoint");
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _onlyOwner();
    }

    receive() external payable {}
}