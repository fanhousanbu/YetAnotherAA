// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.17;

abstract contract BLS12381Helper {

    constructor() {}

    // g1.One
    bytes internal constant _g1One_1 = hex"00000000000000000000000000000000023659e020fb05bf0a737b7636456978e66d4c057fbdfea6c564c12b405df0fa76909167718cd77bd44a6edf32b31533000000000000000000000000000000000469a5322d8bcd79731ea2cae38aa60d94bdb5a5a0ca8fa3a8f7c1e9ef8e95fac4eeb86732e9a2ce606311c981e7ca45";

    bytes internal constant _g1One_2 = hex"0000000000000000000000000000000004a45481ef6f871af3613c0c64b3048f73e5814ccbee7739c813ef8497c03d534a315442103482cd163b27bfec576c280000000000000000000000000000000007b3a7d64f582932a62de5f5ce08433f652e5a19ba8176bb2a821802f0ef492347443f1cfd6a024c7c806162969c3997";

    function Aggregate() public view returns(bytes memory) {
        return _g1Add(_g1One_1, _g1One_2);
    }

    function _g1Add(bytes memory a, bytes memory b) internal view returns(bytes memory c) {
        bytes memory input = new bytes(256);
        assembly {
            mstore(input, 0) // set length = 0 for append
        }
        _append(input, a);
        _append(input, b);
        require(input.length == 256, "_g1Add malformed input");
        bool success;
        c = new bytes(128);
        assembly {
            success := staticcall(gas(), 0x0b, add(input, 32), 256, add(c, 32), 128)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    function _g1Mul(bytes memory point, uint256 scalar) internal view returns(bytes memory c) {
        (bytes memory input) = abi.encodePacked(point, scalar); 
        require(input.length == 160, "_g1Mul malformed input");
        bool success;
        c = new bytes(128);
        assembly {
            success := staticcall(sub(gas(), 2000), 11, add(input, 32), 160, add(c, 32), 128)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    // cheaper than bytes concat :)
    function _append(bytes memory dst, bytes memory src) internal view {
      
        assembly {
            // resize

            let priorLength := mload(dst)
            
            mstore(dst, add(priorLength, mload(src)))
        
            // copy    

            pop(
                staticcall(
                  gas(), 4, 
                  add(src, 32), // src data start
                  mload(src), // src length 
                  add(dst, add(32, priorLength)), // dst write ptr
                  mload(dst)
                ) 
            )
        }
    }
}