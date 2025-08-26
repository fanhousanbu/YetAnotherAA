// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./AAStarValidator.sol";

interface IAccount {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
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

    function _initialize(address anOwner, address _aaStarValidator, bool _useAAStarValidator) internal virtual {
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
    function setAAStarValidator(address _aaStarValidator, bool _useAAStarValidator) external onlyOwner {
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

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external virtual override returns (uint256 validationData) {
        _requireFromEntryPoint();
        validationData = _validateSignature(userOp, userOpHash);
        _validateNonce(userOp.nonce);
        _payPrefund(missingAccountFunds);
    }

    /**
     * @dev Enhanced signature validation with AAStarValidator support using dual verification
     * Signature format: [nodeIds][blsSignature][messagePoint][aaSignature]
     * - nodeIds: bytes32[] array of BLS node identifiers (dynamic length)
     * - blsSignature: 256 bytes G2 BLS aggregate signature
     * - messagePoint: 256 bytes G2 point (provided by signer, verified by BLS)
     * - aaSignature: 65 bytes ECDSA signature from account owner (validates userOpHash)
     *
     * Security Model:
     * - AA signature validates userOpHash (ensures binding to specific UserOperation)
     * - BLS signature validates messagePoint (leverages aggregate signature security)
     * - Dual verification provides security even if messagePoint is manipulated
     */
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();

        // Use AAStarValidator if enabled and available
        if (useAAStarValidator && address(aaStarValidator) != address(0)) {
            try this._parseAndValidateAAStarSignature(userOp.signature, userOpHash) returns (bool isValid) {
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
     * @dev Parse and validate AAStarValidator signature format with dual verification
     * This is a public function to allow try/catch pattern
     * Dual verification: AA signature validates userOpHash, BLS validates messagePoint
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
            bytes memory messagePoint,
            bytes memory aaSignature
        ) = _parseAAStarSignature(signature);

        // SECURITY: AA signature must validate userOpHash (ensures binding to specific userOp)
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recoveredSigner = ECDSA.recover(hash, aaSignature);

        // Validate that the AA signature is from the owner
        if (recoveredSigner != owner) {
            return false;
        }

        // Use AAStarValidator for BLS validation
        return aaStarValidator.validateAggregateSignature(nodeIds, blsSignature, messagePoint);
    }

    /**
     * @dev Parse AAStarValidator signature format
     * Format: [nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
     */
    function _parseAAStarSignature(
        bytes calldata signature
    )
        internal
        pure
        returns (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory messagePoint,
            bytes memory aaSignature
        )
    {
        require(signature.length >= 32 + 256 + 256 + 65, "Invalid signature length");

        // Parse nodeIds length
        uint256 nodeIdsLength = abi.decode(signature[0:32], (uint256));
        require(nodeIdsLength > 0 && nodeIdsLength <= 100, "Invalid nodeIds length");

        uint256 nodeIdsDataLength = nodeIdsLength * 32;
        require(signature.length >= 32 + nodeIdsDataLength + 256 + 256 + 65, "Signature too short");

        // Parse nodeIds array
        nodeIds = new bytes32[](nodeIdsLength);
        for (uint256 i = 0; i < nodeIdsLength; i++) {
            uint256 offset = 32 + i * 32;
            nodeIds[i] = bytes32(signature[offset:offset + 32]);
        }

        // Parse other components
        uint256 blsOffset = 32 + nodeIdsDataLength;
        uint256 messagePointOffset = blsOffset + 256;
        uint256 aaOffset = messagePointOffset + 256;

        blsSignature = signature[blsOffset:messagePointOffset];
        messagePoint = signature[messagePointOffset:aaOffset];
        aaSignature = signature[aaOffset:aaOffset + 65];
    }

    /**
     * @dev Get current validation mode and validator
     */
    function getValidationConfig()
        external
        view
        returns (address validator, bool isAAStarEnabled, address accountOwner)
    {
        return (address(aaStarValidator), useAAStarValidator, owner);
    }

    function _validateNonce(uint256) internal view virtual {
        // no-op
    }

    function _payPrefund(uint256 missingAccountFunds) internal virtual {
        if (missingAccountFunds != 0) {
            (bool success, ) = payable(msg.sender).call{ value: missingAccountFunds, gas: type(uint256).max }("");
            (success);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{ value: value }(data);
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
    //                    TESTING FUNCTIONS
    // =============================================================

    /**
     * @dev Public test function for signature parsing - bypasses access controls
     * FOR TESTING ONLY - DO NOT USE IN PRODUCTION
     */
    function testParseAAStarSignature(
        bytes calldata signature
    )
        external
        pure
        returns (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory messagePoint,
            bytes memory aaSignature
        )
    {
        return _parseAAStarSignature(signature);
    }

    /**
     * @dev Public test function for signature validation - bypasses access controls
     * FOR TESTING ONLY - DO NOT USE IN PRODUCTION
     */
    function testValidateAAStarSignature(
        bytes calldata signature,
        bytes32 userOpHash
    ) external view returns (bool isValid) {
        // Parse signature components
        (
            bytes32[] memory nodeIds,
            bytes memory blsSignature,
            bytes memory messagePoint,
            bytes memory aaSignature
        ) = _parseAAStarSignature(signature);

        // SECURITY: AA signature must validate userOpHash (ensures binding to specific userOp)
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recoveredSigner = ECDSA.recover(hash, aaSignature);

        // Validate that the AA signature is from the owner
        if (recoveredSigner != owner) {
            return false;
        }

        // Use AAStarValidator for BLS validation (if enabled)
        if (useAAStarValidator && address(aaStarValidator) != address(0)) {
            return aaStarValidator.validateAggregateSignature(nodeIds, blsSignature, messagePoint);
        }

        return false; // No BLS validation available
    }

    /**
     * @dev Test function to get recovered address from signature
     * FOR TESTING ONLY - DO NOT USE IN PRODUCTION
     */
    function testRecoverAAAddress(
        bytes calldata signature,
        bytes32 userOpHash
    ) external pure returns (address recoveredAddress) {
        // Parse signature to get AA signature
        (, , , bytes memory aaSignature) = _parseAAStarSignature(signature);

        // Recover address from userOpHash
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        return ECDSA.recover(hash, aaSignature);
    }

    receive() external payable {}
}
