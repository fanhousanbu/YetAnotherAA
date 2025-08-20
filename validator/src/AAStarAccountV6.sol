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
 * @title AAStarAccountV6
 * @dev ERC-4337 v0.6 account with AAStarValidator integration for BLS aggregate signature validation
 */
contract AAStarAccountV6 is IAccount, UUPSUpgradeable, Initializable {
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
     * @dev Enhanced signature validation with AAStarValidator support
     * Signature format: [nodeIds][blsSignature][aaSignature]
     * - nodeIds: bytes32[] array of BLS node identifiers (dynamic length)
     * - blsSignature: 256 bytes G2 BLS aggregate signature
     * - aaSignature: 65 bytes ECDSA signature from account owner
     * messagePoint is dynamically generated from userOpHash via BLS hashToCurve
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
     * @dev Parse and validate AAStarValidator signature format
     * This is a public function to allow try/catch pattern
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
        
        // Generate messagePoint from userOpHash
        bytes memory messagePoint = _hashToCurveG2(userOpHash);
        
        // Create AA signature for messagePoint hash (as expected by AAStarValidator)
        bytes32 messagePointHash = keccak256(messagePoint);
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messagePointHash)
        );
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, aaSignature);
        
        // Validate that the AA signature is from the owner
        if (recoveredSigner != owner) {
            return false;
        }
        
        // Use AAStarValidator for BLS validation
        return aaStarValidator.validateAggregateSignature(
            nodeIds,
            blsSignature,
            messagePoint,
            owner,
            aaSignature
        );
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

    // =============================================================
    //                    BLS12-381 G2 HASH TO CURVE
    // =============================================================
    
    /// @dev EIP-2537 G2 map field to curve precompile address
    address private constant BLS12_MAP_FP2_TO_G2 = 0x0000000000000000000000000000000000000011;
    
    /// @dev Domain separation tag for BLS signature scheme
    bytes private constant DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
    
    /**
     * @dev Convert bytes32 hash to BLS G2 curve point using simplified deterministic mapping
     * 
     * NOTE: This is a simplified implementation for testing purposes.
     * In production, you should use a proper BLS12-381 hashToCurve implementation
     * or coordinate with the off-chain signer to ensure compatible message generation.
     * 
     * @param hash The input hash to be mapped to G2 curve
     * @return messagePoint The resulting G2 point (256 bytes)
     */
    function _hashToCurveG2(bytes32 hash) internal pure returns (bytes memory messagePoint) {
        // For testing: create a deterministic but valid-looking G2 point
        // This should be replaced with proper hashToCurve in production
        messagePoint = new bytes(256);
        
        // Fill with deterministic data based on hash
        bytes32 seed = keccak256(abi.encodePacked(hash, "BLS_G2_POINT"));
        
        // Create deterministic G2 point structure (not cryptographically secure)
        for (uint256 i = 0; i < 8; i++) {
            bytes32 chunk = keccak256(abi.encodePacked(seed, i));
            for (uint256 j = 0; j < 32; j++) {
                messagePoint[i * 32 + j] = chunk[j];
            }
        }
    }
    
    // Simplified implementation - complex precompile functions removed for now
    // These can be added back when proper EIP-2537 implementation is needed

    receive() external payable {}
}