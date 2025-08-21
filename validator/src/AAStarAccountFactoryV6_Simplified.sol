// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./AAStarAccountV6_Simplified.sol";

/**
 * @title AAStarAccountFactoryV6_Simplified
 * @dev 简化版工厂合约，创建使用简化验证逻辑的AAStarAccount
 */
contract AAStarAccountFactoryV6_Simplified {
    AAStarAccountV6_Simplified public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new AAStarAccountV6_Simplified(_entryPoint);
    }

    /**
     * @dev 创建AAStarAccount（简化版）
     * @param owner 账户所有者地址
     * @param aaStarValidator AAStarValidator合约地址
     * @param salt 创建账户的盐值
     */
    function createAAStarAccount(
        address owner,
        address aaStarValidator,
        uint256 salt
    ) public returns (AAStarAccountV6_Simplified ret) {
        address addr = getAddress(owner, aaStarValidator, true, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return AAStarAccountV6_Simplified(payable(addr));
        }
        ret = AAStarAccountV6_Simplified(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeWithSignature(
                        "initialize(address,address,bool)", 
                        owner, 
                        aaStarValidator, 
                        true
                    )
                )
            )
        );
    }

    /**
     * @dev 获取账户地址（不创建）
     * @param owner 账户所有者地址
     * @param aaStarValidator AAStarValidator合约地址
     * @param useAAStarValidator 是否使用AAStarValidator
     * @param salt 创建账户的盐值
     */
    function getAddress(
        address owner,
        address aaStarValidator,
        bool useAAStarValidator,
        uint256 salt
    ) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt), 
            keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeWithSignature(
                        "initialize(address,address,bool)", 
                        owner, aaStarValidator, useAAStarValidator
                    )
                )
            )),
            address(this)
        );
    }

    /**
     * @dev 获取实现合约地址
     */
    function getImplementation() external view returns (address) {
        return address(accountImplementation);
    }
}