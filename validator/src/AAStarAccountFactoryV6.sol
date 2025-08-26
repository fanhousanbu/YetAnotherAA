// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./AAStarAccountV6.sol";

/**
 * @title AAStarAccountFactoryV6
 * @dev Factory for creating ERC-4337 v0.6 accounts with AAStarValidator integration
 */
contract AAStarAccountFactoryV6 {
    AAStarAccountV6 public immutable accountImplementation;

    // Events
    event AccountCreated(
        address indexed account,
        address indexed owner,
        address aaStarValidator,
        bool useAAStarValidator,
        uint256 salt
    );

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new AAStarAccountV6(_entryPoint);
    }

    /**
     * @dev Create account with standard ECDSA validation
     */
    function createAccount(address owner, uint256 salt) public returns (AAStarAccountV6 ret) {
        return createAccountWithAAStarValidator(owner, address(0), false, salt);
    }

    /**
     * @dev Create account with AAStarValidator for BLS aggregate signature validation
     * @param owner The account owner
     * @param aaStarValidator Address of the AAStarValidator contract
     * @param useAAStarValidator Whether to use AAStarValidator by default
     * @param salt Salt for deterministic address generation
     */
    function createAccountWithAAStarValidator(
        address owner,
        address aaStarValidator,
        bool useAAStarValidator,
        uint256 salt
    ) public returns (AAStarAccountV6 ret) {
        address addr = getAddress(owner, aaStarValidator, useAAStarValidator, salt);
        uint codeSize = addr.code.length;

        if (codeSize > 0) {
            return AAStarAccountV6(payable(addr));
        }

        ret = AAStarAccountV6(
            payable(
                new ERC1967Proxy{ salt: bytes32(salt) }(
                    address(accountImplementation),
                    abi.encodeWithSignature(
                        "initialize(address,address,bool)",
                        owner,
                        aaStarValidator,
                        useAAStarValidator
                    )
                )
            )
        );

        emit AccountCreated(address(ret), owner, aaStarValidator, useAAStarValidator, salt);
    }

    /**
     * @dev Get deterministic address for standard account
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return getAddress(owner, address(0), false, salt);
    }

    /**
     * @dev Get deterministic address for account with AAStarValidator
     */
    function getAddress(
        address owner,
        address aaStarValidator,
        bool useAAStarValidator,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeWithSignature(
                                "initialize(address,address,bool)",
                                owner,
                                aaStarValidator,
                                useAAStarValidator
                            )
                        )
                    )
                )
            );
    }

    /**
     * @dev Batch create multiple accounts with different configurations
     */
    function batchCreateAccounts(
        address[] calldata owners,
        address[] calldata aaStarValidators,
        bool[] calldata useAAStarValidators,
        uint256[] calldata salts
    ) external returns (AAStarAccountV6[] memory accounts) {
        require(
            owners.length == aaStarValidators.length &&
                owners.length == useAAStarValidators.length &&
                owners.length == salts.length,
            "Array length mismatch"
        );

        accounts = new AAStarAccountV6[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            accounts[i] = createAccountWithAAStarValidator(
                owners[i],
                aaStarValidators[i],
                useAAStarValidators[i],
                salts[i]
            );
        }
    }

    /**
     * @dev Create account specifically for AAStarValidator usage
     * This is a convenience function for common use case
     */
    function createAAStarAccount(
        address owner,
        address aaStarValidator,
        uint256 salt
    ) external returns (AAStarAccountV6 ret) {
        require(aaStarValidator != address(0), "AAStarValidator address required");
        return createAccountWithAAStarValidator(owner, aaStarValidator, true, salt);
    }

    /**
     * @dev Batch create AAStarValidator accounts
     */
    function batchCreateAAStarAccounts(
        address[] calldata owners,
        address aaStarValidator,
        uint256[] calldata salts
    ) external returns (AAStarAccountV6[] memory accounts) {
        require(aaStarValidator != address(0), "AAStarValidator address required");
        require(owners.length == salts.length, "Array length mismatch");

        accounts = new AAStarAccountV6[](owners.length);

        for (uint256 i = 0; i < owners.length; i++) {
            accounts[i] = createAccountWithAAStarValidator(owners[i], aaStarValidator, true, salts[i]);
        }
    }

    /**
     * @dev Get account implementation address
     */
    function getImplementation() external view returns (address) {
        return address(accountImplementation);
    }

    /**
     * @dev Check if account exists at given address
     */
    function isAccountDeployed(
        address owner,
        address aaStarValidator,
        bool useAAStarValidator,
        uint256 salt
    ) external view returns (bool) {
        address addr = getAddress(owner, aaStarValidator, useAAStarValidator, salt);
        return addr.code.length > 0;
    }
}
