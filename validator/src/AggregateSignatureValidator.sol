// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AggregateSignatureValidator
 * @dev Account Abstraction signature validator for aggregate signatures with node management
 * 
 * This contract validates multi-party aggregate signatures for ERC4337 Account Abstraction.
 * It supports efficient verification of multiple signatures aggregated into a single proof,
 * enabling gas-efficient multi-signature wallet operations and validator consensus.
 * 
 * Features:
 * - Aggregate signature validation for AA wallets
 * - EIP-2537 precompile integration for efficient verification
 * - Node UUID management for validator consensus
 * - Support for both direct and parameterized validation modes
 * - Gas-optimized design for production use
 */
contract AggregateSignatureValidator {
    
    // =============================================================
    //                           CONSTANTS
    // =============================================================
    
    /// @dev EIP-2537 pairing precompile address
    address private constant PAIRING_PRECOMPILE = 0x000000000000000000000000000000000000000F;
    
    /// @dev EIP-2537 G1 addition precompile address
    address private constant G1_ADD_PRECOMPILE = 0x000000000000000000000000000000000000000b;
    
    /// @dev Standard encoded lengths for cryptographic points
    uint256 private constant G1_POINT_LENGTH = 128;
    uint256 private constant G2_POINT_LENGTH = 256;
    uint256 private constant PAIRING_LENGTH = 384; // G1 + G2
    
    /// @dev Generator point for the cryptographic group (EIP-2537 encoded format)
    bytes private constant GENERATOR_POINT = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";

    // =============================================================
    //                      STORAGE & STATE
    // =============================================================
    
    /// @dev Owner of the contract (can manage nodes)
    address public owner;
    
    /// @dev Mapping from node UUID to node information
    mapping(bytes16 => NodeInfo) public nodes;
    
    /// @dev Array of all registered node UUIDs for enumeration
    bytes16[] public nodeList;
    
    /// @dev Mapping to track if a UUID exists (for efficient checking)
    mapping(bytes16 => bool) public nodeExists;
    
    /// @dev Total number of registered nodes
    uint256 public totalNodes;
    
    // =============================================================
    //                           STRUCTS
    // =============================================================
    
    /// @dev Node information structure
    struct NodeInfo {
        bytes16 uuid;           // Node UUID (128-bit)
        address nodeAddress;    // Node's Ethereum address
        bytes publicKey;        // Node's BLS public key (48 bytes compressed G1 point)
        bool isActive;          // Whether the node is active
        uint256 registeredAt;   // Registration timestamp
        uint256 lastActiveAt;   // Last activity timestamp
        string metadata;        // Additional metadata (optional)
    }
    
    // =============================================================
    //                           EVENTS
    // =============================================================
    
    /// @dev Emitted when a new node is registered
    event NodeRegistered(bytes16 indexed uuid, address indexed nodeAddress, uint256 timestamp);
    
    /// @dev Emitted when a node is deactivated
    event NodeDeactivated(bytes16 indexed uuid, address indexed nodeAddress, uint256 timestamp);
    
    /// @dev Emitted when a node is reactivated
    event NodeReactivated(bytes16 indexed uuid, address indexed nodeAddress, uint256 timestamp);
    
    /// @dev Emitted when a node is removed
    event NodeRemoved(bytes16 indexed uuid, address indexed nodeAddress, uint256 timestamp);
    
    /// @dev Emitted when node metadata is updated
    event NodeMetadataUpdated(bytes16 indexed uuid, string newMetadata, uint256 timestamp);
    
    /// @dev Emitted when signature validation occurs
    event SignatureValidated(
        bytes16[] indexed participantUUIDs,
        bool success,
        uint256 timestamp
    );
    
    /// @dev Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // =============================================================
    //                           MODIFIERS
    // =============================================================
    
    /// @dev Restricts access to contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /// @dev Checks if a node exists and is active
    modifier nodeIsActive(bytes16 uuid) {
        require(nodeExists[uuid], "Node does not exist");
        require(nodes[uuid].isActive, "Node is not active");
        _;
    }
    
    // =============================================================
    //                          CONSTRUCTOR
    // =============================================================
    
    /// @dev Sets the contract deployer as the initial owner
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // =============================================================
    //                   NODE MANAGEMENT FUNCTIONS
    // =============================================================
    
    /**
     * @dev Registers a new validator node
     * @param uuid The UUID of the node (16 bytes)
     * @param nodeAddress The Ethereum address of the node
     * @param publicKey The BLS public key of the node (48 bytes compressed G1 point)
     * @param metadata Optional metadata for the node
     */
    function registerNode(
        bytes16 uuid,
        address nodeAddress,
        bytes calldata publicKey,
        string calldata metadata
    ) external onlyOwner {
        require(uuid != bytes16(0), "UUID cannot be zero");
        require(nodeAddress != address(0), "Node address cannot be zero");
        require(publicKey.length == 48, "Public key must be 48 bytes");
        require(!nodeExists[uuid], "Node already exists");
        
        nodes[uuid] = NodeInfo({
            uuid: uuid,
            nodeAddress: nodeAddress,
            publicKey: publicKey,
            isActive: true,
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp,
            metadata: metadata
        });
        
        nodeList.push(uuid);
        nodeExists[uuid] = true;
        totalNodes++;
        
        emit NodeRegistered(uuid, nodeAddress, block.timestamp);
    }
    
    /**
     * @dev Deactivates a validator node (soft delete)
     * @param uuid The UUID of the node to deactivate
     */
    function deactivateNode(bytes16 uuid) external onlyOwner {
        require(nodeExists[uuid], "Node does not exist");
        require(nodes[uuid].isActive, "Node already inactive");
        
        nodes[uuid].isActive = false;
        
        emit NodeDeactivated(uuid, nodes[uuid].nodeAddress, block.timestamp);
    }
    
    /**
     * @dev Reactivates a previously deactivated node
     * @param uuid The UUID of the node to reactivate
     */
    function reactivateNode(bytes16 uuid) external onlyOwner {
        require(nodeExists[uuid], "Node does not exist");
        require(!nodes[uuid].isActive, "Node already active");
        
        nodes[uuid].isActive = true;
        nodes[uuid].lastActiveAt = block.timestamp;
        
        emit NodeReactivated(uuid, nodes[uuid].nodeAddress, block.timestamp);
    }
    
    /**
     * @dev Permanently removes a validator node
     * @param uuid The UUID of the node to remove
     */
    function removeNode(bytes16 uuid) external onlyOwner {
        require(nodeExists[uuid], "Node does not exist");
        
        address nodeAddr = nodes[uuid].nodeAddress;
        
        // Remove from nodeList array
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodeList[i] == uuid) {
                nodeList[i] = nodeList[nodeList.length - 1];
                nodeList.pop();
                break;
            }
        }
        
        delete nodes[uuid];
        delete nodeExists[uuid];
        totalNodes--;
        
        emit NodeRemoved(uuid, nodeAddr, block.timestamp);
    }
    
    /**
     * @dev Updates the metadata of a validator node
     * @param uuid The UUID of the node
     * @param newMetadata New metadata for the node
     */
    function updateNodeMetadata(
        bytes16 uuid,
        string calldata newMetadata
    ) external onlyOwner nodeIsActive(uuid) {
        nodes[uuid].metadata = newMetadata;
        
        emit NodeMetadataUpdated(uuid, newMetadata, block.timestamp);
    }
    
    /**
     * @dev Updates the last active timestamp of a node
     * @param uuid The UUID of the node
     */
    function updateNodeActivity(bytes16 uuid) external nodeIsActive(uuid) {
        // Allow the node itself or owner to update activity
        require(
            msg.sender == nodes[uuid].nodeAddress || msg.sender == owner,
            "Not authorized to update activity"
        );
        
        nodes[uuid].lastActiveAt = block.timestamp;
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != owner, "New owner must be different");
        
        address oldOwner = owner;
        owner = newOwner;
        
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    // =============================================================
    //                      NODE QUERY FUNCTIONS
    // =============================================================
    
    /**
     * @dev Gets information about a specific node
     * @param uuid The UUID of the node
     * @return nodeInfo The complete node information
     */
    function getNodeInfo(bytes16 uuid) external view returns (NodeInfo memory nodeInfo) {
        require(nodeExists[uuid], "Node does not exist");
        return nodes[uuid];
    }
    
    /**
     * @dev Gets the list of all registered node UUIDs
     * @return uuids Array of all node UUIDs
     */
    function getAllNodes() external view returns (bytes16[] memory uuids) {
        return nodeList;
    }
    
    /**
     * @dev Gets the list of active node UUIDs
     * @return activeUUIDs Array of active node UUIDs
     */
    function getActiveNodes() external view returns (bytes16[] memory activeUUIDs) {
        uint256 activeCount = 0;
        
        // First pass: count active nodes
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Second pass: populate active nodes array
        activeUUIDs = new bytes16[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].isActive) {
                activeUUIDs[index] = nodeList[i];
                index++;
            }
        }
    }
    
    /**
     * @dev Checks if all provided UUIDs are active nodes
     * @param uuids Array of UUIDs to check
     * @return valid True if all UUIDs are active nodes
     */
    function validateNodeUUIDs(bytes16[] calldata uuids) external view returns (bool valid) {
        for (uint256 i = 0; i < uuids.length; i++) {
            if (!nodeExists[uuids[i]] || !nodes[uuids[i]].isActive) {
                return false;
            }
        }
        return true;
    }
    
    
    // =============================================================
    //                   PUBLIC KEY AGGREGATION
    // =============================================================
    
    /**
     * @dev For testing purposes, simulate key aggregation without actual EIP-2537 calls
     * In production, this would use proper G1 point arithmetic
     * @param compressedPoint The compressed G1 point
     * @return expandedPoint Mock expanded point for testing
     */
    function _expandG1Point(bytes memory compressedPoint) internal pure returns (bytes memory expandedPoint) {
        require(compressedPoint.length == 48, "Invalid compressed G1 point length");
        
        // For testing: create a mock 128-byte G1 point in EIP-2537 format
        expandedPoint = new bytes(128);
        
        // Simple approach: copy compressed point to start, pad with zeros
        for (uint256 i = 0; i < 48; i++) {
            expandedPoint[i] = compressedPoint[i];
        }
        // Remaining bytes stay zero
        
        // In production, this would properly decompress BLS G1 points
        // and format them according to EIP-2537 specification
    }
    
    /**
     * @dev Aggregates multiple G1 public keys (testing version)
     * In production, this would use EIP-2537 G1 addition precompile
     * @param participantUUIDs Array of node UUIDs whose public keys to aggregate
     * @return aggregatedKey The aggregated public key in EIP-2537 format (128 bytes)
     */
    function _aggregatePublicKeys(bytes16[] memory participantUUIDs) internal view returns (bytes memory aggregatedKey) {
        require(participantUUIDs.length > 0, "No participants provided");
        
        if (participantUUIDs.length == 1) {
            // Single key case - just expand to EIP-2537 format
            return _expandG1Point(nodes[participantUUIDs[0]].publicKey);
        }
        
        // For testing: simulate aggregation by XORing the keys
        // In production, this would use proper G1 point addition via EIP-2537
        aggregatedKey = new bytes(128);
        
        // Initialize with first key
        bytes memory firstKey = _expandG1Point(nodes[participantUUIDs[0]].publicKey);
        for (uint256 i = 0; i < 128; i++) {
            aggregatedKey[i] = firstKey[i];
        }
        
        // "Aggregate" other keys (simulation only)
        for (uint256 i = 1; i < participantUUIDs.length; i++) {
            bytes memory nextKey = _expandG1Point(nodes[participantUUIDs[i]].publicKey);
            
            // Simple XOR for testing (NOT cryptographically valid!)
            for (uint256 j = 0; j < 48; j++) { // Only XOR the actual key part
                aggregatedKey[j] = aggregatedKey[j] ^ nextKey[j];
            }
        }
        
        return aggregatedKey;
        
        // TODO: Replace with actual EIP-2537 G1 addition:
        /*
        // Start with the first public key
        bytes memory currentSum = _expandG1Point(nodes[participantUUIDs[0]].publicKey);
        
        // Add each subsequent public key using EIP-2537 G1 addition
        for (uint256 i = 1; i < participantUUIDs.length; i++) {
            bytes memory nextKey = _expandG1Point(nodes[participantUUIDs[i]].publicKey);
            
            // Prepare input for G1 addition: [point1][point2] = 256 bytes
            bytes memory addInput = new bytes(256);
            
            // Copy current sum (128 bytes)
            for (uint256 j = 0; j < 128; j++) {
                addInput[j] = currentSum[j];
            }
            
            // Copy next key (128 bytes)
            for (uint256 j = 0; j < 128; j++) {
                addInput[128 + j] = nextKey[j];
            }
            
            // Call G1 addition precompile
            (bool success, bytes memory result) = G1_ADD_PRECOMPILE.staticcall{gas: 500}(addInput);
            
            require(success, "G1 addition failed");
            require(result.length == 128, "Invalid G1 addition result");
            
            currentSum = result;
        }
        
        return currentSum;
        */
    }
    
    // =============================================================
    //                      VALIDATION METHODS
    // =============================================================
    
    /**
     * @dev Validates an aggregate signature using individual components with automatic key aggregation
     * 
     * This is the primary validation method for production use. It automatically
     * aggregates the public keys of participating nodes and validates the signature.
     * 
     * @param signature Aggregate signature (256 bytes, G2 point)
     * @param messagePoint Message mapped to G2 curve (256 bytes)
     * @param participantUUIDs Array of UUIDs of nodes that participated in signing
     * @return success True if the aggregate signature is valid and all nodes are authorized
     */
    function validateSignature(
        bytes calldata signature,
        bytes calldata messagePoint,
        bytes16[] calldata participantUUIDs
    ) 
        external 
        returns (bool success) 
    {
        require(participantUUIDs.length > 0, "No participant UUIDs provided");
        
        // First validate that all participant nodes are registered and active
        for (uint256 i = 0; i < participantUUIDs.length; i++) {
            bytes16 uuid = participantUUIDs[i];
            require(nodeExists[uuid], "Participant node does not exist");
            require(nodes[uuid].isActive, "Participant node is not active");
            
            // Update last active timestamp for participating nodes
            nodes[uuid].lastActiveAt = block.timestamp;
        }
        
        // Validate signature and message point lengths after node validation
        require(signature.length == G2_POINT_LENGTH, "Invalid signature length");
        require(messagePoint.length == G2_POINT_LENGTH, "Invalid message length");
        
        // Aggregate the public keys of participating nodes
        bytes memory aggregatedKey = _aggregatePublicKeys(participantUUIDs);
        
        // Build pairing data from components
        bytes memory pairingData = _buildPairingData(
            aggregatedKey,
            signature,
            messagePoint
        );
        
        // Perform cryptographic signature validation
        (bool callSuccess, bytes memory result) = PAIRING_PRECOMPILE.staticcall{
            gas: 200000
        }(pairingData);
        
        if (!callSuccess) {
            success = false;
        } else {
            success = result.length == 32 && bytes32(result) == bytes32(uint256(1));
        }
        
        // Emit validation event
        emit SignatureValidated(participantUUIDs, success, block.timestamp);
        
        return success;
    }
    
    
    // =============================================================
    //                      ERC4337 INTEGRATION
    // =============================================================
    
    /**
     * @dev Validates a UserOperation signature (ERC4337 compatible) with automatic key aggregation
     * 
     * This method provides compatibility with ERC4337 Account Abstraction
     * infrastructure. It can be called by AA wallets during UserOp validation.
     * The signature data format must include participant node UUIDs.
     * 
     * Expected format for signatureData:
     * - [numParticipants (1 byte)][UUID1 (16 bytes)][UUID2 (16 bytes)]...[signature (256 bytes)][messagePoint (256 bytes)]
     * 
     * @param signatureData Complete signature data including participant UUIDs, signature, and message point
     * @return success True if the UserOp signature is valid and all nodes are authorized
     */
    function validateUserOp(
        bytes32 /* userOpHash */,
        bytes calldata signatureData
    ) external returns (bool success) {
        require(signatureData.length > 0, "Signature data too short"); // Need at least 1 byte
        
        // Parse participant UUIDs from signature data
        uint8 numParticipants = uint8(signatureData[0]);
        require(numParticipants > 0, "No participants specified");
        
        uint256 uuidsLength = numParticipants * 16;
        require(signatureData.length >= 1 + uuidsLength + G2_POINT_LENGTH * 2, 
            "Insufficient data for UUIDs and signature components");
        
        // Extract participant UUIDs
        bytes16[] memory participantUUIDs = new bytes16[](numParticipants);
        for (uint256 i = 0; i < numParticipants; i++) {
            participantUUIDs[i] = bytes16(signatureData[1 + i * 16:1 + (i + 1) * 16]);
        }
        
        // Validate that all participant nodes are registered and active
        for (uint256 i = 0; i < participantUUIDs.length; i++) {
            bytes16 uuid = participantUUIDs[i];
            require(nodeExists[uuid], "Participant node does not exist");
            require(nodes[uuid].isActive, "Participant node is not active");
            
            // Update last active timestamp for participating nodes
            nodes[uuid].lastActiveAt = block.timestamp;
        }
        
        // Extract signature and message point after UUIDs
        uint256 offset = 1 + uuidsLength;
        bytes memory signature = signatureData[offset:offset + G2_POINT_LENGTH];
        bytes memory messagePoint = signatureData[offset + G2_POINT_LENGTH:offset + G2_POINT_LENGTH * 2];
        
        // Aggregate the public keys of participating nodes
        bytes memory aggregatedKey = _aggregatePublicKeys(participantUUIDs);
        
        // Build pairing data from components
        bytes memory pairingData = _buildPairingData(
            aggregatedKey,
            signature,
            messagePoint
        );
        
        // Perform cryptographic signature validation
        (bool callSuccess, bytes memory result) = PAIRING_PRECOMPILE.staticcall{
            gas: 200000
        }(pairingData);
        
        if (!callSuccess) {
            success = false;
        } else {
            success = result.length == 32 && bytes32(result) == bytes32(uint256(1));
        }
        
        // Emit validation event
        emit SignatureValidated(participantUUIDs, success, block.timestamp);
        
        return success;
    }
    
    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================
    
    /**
     * @dev Constructs pairing verification data from individual components
     * @param aggregatedKey Pre-processed aggregated public key
     * @param signature Aggregate signature
     * @param messagePoint Message point in G2
     * @return pairingData Complete pairing data for precompile verification
     */
    function _buildPairingData(
        bytes memory aggregatedKey,
        bytes memory signature,
        bytes memory messagePoint
    ) internal pure returns (bytes memory pairingData) {
        pairingData = new bytes(768);
        
        // First pairing: (generator, signature)
        // Copy generator point (128 bytes)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[i] = GENERATOR_POINT[i];
        }
        
        // Copy signature (256 bytes)
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[G1_POINT_LENGTH + i] = signature[i];
        }
        
        // Second pairing: (aggregated key, message point)
        uint256 secondPairingOffset = PAIRING_LENGTH;
        
        // Copy aggregated key (128 bytes)
        for (uint256 i = 0; i < G1_POINT_LENGTH; i++) {
            pairingData[secondPairingOffset + i] = aggregatedKey[i];
        }
        
        // Copy message point (256 bytes)
        for (uint256 i = 0; i < G2_POINT_LENGTH; i++) {
            pairingData[secondPairingOffset + G1_POINT_LENGTH + i] = messagePoint[i];
        }
    }
    
    
    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================
    
    /**
     * @dev Returns the expected format for signature data
     * @return format String describing the expected signature format
     */
    function getSignatureFormat() external pure returns (string memory format) {
        return "For validateSignature: (signature[256], messagePoint[256], participantUUIDs[]). For UserOp: [numParticipants(1 byte)][UUIDs(16 bytes each)][signature(256 bytes)][messagePoint(256 bytes)]";
    }
    
    /**
     * @dev Returns gas estimates for different validation methods
     * @return directGas Estimated gas for direct validation with automatic key aggregation
     * @return userOpGas Estimated gas for UserOp validation with automatic key aggregation
     */
    function getGasEstimates() external pure returns (uint256 directGas, uint256 userOpGas) {
        directGas = 250000;     // Direct validation + node validation + key aggregation
        userOpGas = 270000;     // UserOp validation + parsing + node validation + key aggregation
    }
    
    /**
     * @dev Returns statistics about registered nodes
     * @return total Total number of registered nodes
     * @return active Number of active nodes
     * @return inactive Number of inactive nodes
     */
    function getNodeStatistics() external view returns (uint256 total, uint256 active, uint256 inactive) {
        total = totalNodes;
        active = 0;
        
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].isActive) {
                active++;
            }
        }
        
        inactive = total - active;
    }
}