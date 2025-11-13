// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MinimalDelegationContract.sol";

/**
 * @title DelegationFactory
 * @notice Factory for deploying EIP-7702 delegation contracts using CREATE2
 * @dev Enables deterministic deployment of delegation contracts for EOAs
 */
contract DelegationFactory {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error ZeroAddress();
    error DeploymentFailed();
    error AlreadyDeployed();
    error Unauthorized();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event DelegationDeployed(
        address indexed owner,
        address indexed delegation,
        address indexed paymaster
    );

    event DefaultPaymasterUpdated(
        address indexed oldPaymaster,
        address indexed newPaymaster
    );

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    // Keccak256 of "MinimalDelegationContract"
    bytes32 private constant CREATION_CODE_HASH = keccak256(type(MinimalDelegationContract).creationCode);

    /*//////////////////////////////////////////////////////////////
                            IMMUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    address public immutable OWNER;
    address public immutable SBT_CONTRACT;
    address public immutable XPNTS_CONTRACT;

    /*//////////////////////////////////////////////////////////////
                            MUTABLE STORAGE
    //////////////////////////////////////////////////////////////*/
    address public DEFAULT_PAYMASTER;
    mapping(address => address) public userDelegations;
    mapping(address => bool) public isDelegation;
    address[] public allDelegations;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(
        address _defaultPaymaster,
        address _sbtContract,
        address _xPNTsContract
    ) {
        if (_defaultPaymaster == address(0)) revert ZeroAddress();
        OWNER = msg.sender;
        DEFAULT_PAYMASTER = _defaultPaymaster;
        SBT_CONTRACT = _sbtContract;
        XPNTS_CONTRACT = _xPNTsContract;
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != OWNER) revert Unauthorized();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                        DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deploy delegation contract for an EOA
     * @dev Uses CREATE2 for deterministic address
     * @param owner EOA address to create delegation for
     * @return delegation Address of deployed delegation contract
     */
    function deployDelegation(
        address owner
    ) external returns (address delegation) {
        if (owner == address(0)) revert ZeroAddress();
        if (userDelegations[owner] != address(0)) revert AlreadyDeployed();

        // Calculate salt for deterministic deployment
        bytes32 salt = keccak256(abi.encodePacked(owner, block.chainid));

        // Get creation code
        bytes memory bytecode = type(MinimalDelegationContract).creationCode;

        // Encode constructor arguments
        bytes memory initCode = abi.encodePacked(
            bytecode,
            abi.encode(owner, DEFAULT_PAYMASTER, SBT_CONTRACT, XPNTS_CONTRACT)
        );

        // Deploy using CREATE2
        assembly {
            delegation := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }

        if (delegation == address(0)) revert DeploymentFailed();

        // Store mapping
        userDelegations[owner] = delegation;
        isDelegation[delegation] = true;
        allDelegations.push(delegation);

        emit DelegationDeployed(owner, delegation, DEFAULT_PAYMASTER);
    }

    /**
     * @notice Deploy delegation contract with custom paymaster
     * @param owner EOA address
     * @param paymaster Custom paymaster address
     * @return delegation Address of deployed delegation contract
     */
    function deployDelegationWithPaymaster(
        address owner,
        address paymaster
    ) external returns (address delegation) {
        if (owner == address(0) || paymaster == address(0)) revert ZeroAddress();
        if (userDelegations[owner] != address(0)) revert AlreadyDeployed();

        bytes32 salt = keccak256(abi.encodePacked(owner, paymaster, block.chainid));
        bytes memory bytecode = type(MinimalDelegationContract).creationCode;

        bytes memory initCode = abi.encodePacked(
            bytecode,
            abi.encode(owner, paymaster, SBT_CONTRACT, XPNTS_CONTRACT)
        );

        assembly {
            delegation := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }

        if (delegation == address(0)) revert DeploymentFailed();

        userDelegations[owner] = delegation;
        isDelegation[delegation] = true;
        allDelegations.push(delegation);

        emit DelegationDeployed(owner, delegation, paymaster);
    }

    /*//////////////////////////////////////////////////////////////
                        PREDICTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Predict delegation contract address
     * @param owner EOA address
     * @return predicted Predicted deployment address
     */
    function predictDelegationAddress(address owner) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(owner, block.chainid));
        bytes memory bytecode = type(MinimalDelegationContract).creationCode;
        bytes memory initCode = abi.encodePacked(
            bytecode,
            abi.encode(owner, DEFAULT_PAYMASTER, SBT_CONTRACT, XPNTS_CONTRACT, uint256(0))
        );

        bytes32 data = keccak256(initCode);
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, data)))));
    }

    /**
     * @notice Predict delegation address with custom paymaster
     * @param owner EOA address
     * @param paymaster Custom paymaster address
     * @return predicted Predicted deployment address
     */
    function predictDelegationAddressWithPaymaster(
        address owner,
        address paymaster
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(owner, paymaster, block.chainid));
        bytes memory bytecode = type(MinimalDelegationContract).creationCode;
        bytes memory initCode = abi.encodePacked(
            bytecode,
            abi.encode(owner, paymaster, SBT_CONTRACT, XPNTS_CONTRACT, uint256(0))
        );

        bytes32 data = keccak256(initCode);
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, data)))));
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get delegation address for owner
     * @param owner EOA address
     * @return delegation Delegation contract address or zero address if not deployed
     */
    function getDelegation(address owner) external view returns (address delegation) {
        return userDelegations[owner];
    }

    /**
     * @notice Check if contract is a delegation
     * @param contractAddress Contract address to check
     * @return isDel True if is a delegation contract
     */
    function isDelegationContract(address contractAddress) external view returns (bool isDel) {
        return isDelegation[contractAddress];
    }

    /**
     * @notice Get total number of delegations
     * @return count Total delegation count
     */
    function getDelegationCount() external view returns (uint256 count) {
        return allDelegations.length;
    }

    /**
     * @notice Get delegation at index
     * @param index Index in allDelegations array
     * @return delegation Delegation contract address
     */
    function getDelegationAt(uint256 index) external view returns (address delegation) {
        require(index < allDelegations.length, "Index out of bounds");
        return allDelegations[index];
    }

    /*//////////////////////////////////////////////////////////////
                    BATCH DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deploy multiple delegation contracts
     * @dev Gas-intensive, use with care
     * @param owners Array of EOA addresses
     * @return delegations Array of deployed delegation addresses
     */
    function batchDeployDelegations(
        address[] calldata owners
    ) external returns (address[] memory delegations) {
        delegations = new address[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            delegations[i] = this.deployDelegation(owners[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update default paymaster for future deployments
     * @dev Only callable by factory owner
     * @param newPaymaster New paymaster address
     */
    function updateDefaultPaymaster(address newPaymaster) external onlyOwner {
        if (newPaymaster == address(0)) revert ZeroAddress();
        address oldPaymaster = DEFAULT_PAYMASTER;
        DEFAULT_PAYMASTER = newPaymaster;
        emit DefaultPaymasterUpdated(oldPaymaster, newPaymaster);
    }

    /*//////////////////////////////////////////////////////////////
                              METADATA
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get factory configuration
     * @return defaultPaymaster Default paymaster address
     * @return sbtContract SBT contract address
     * @return xPNTsContract xPNTs contract address
     */
    function getConfiguration()
        external
        view
        returns (
            address defaultPaymaster,
            address sbtContract,
            address xPNTsContract
        )
    {
        return (DEFAULT_PAYMASTER, SBT_CONTRACT, XPNTS_CONTRACT);
    }
}