// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {PactEventVault} from "./PactEventVault.sol";

/// @notice Creates one deterministic escrow vault per event from an organizer-signed authorization.
/// @dev Anyone may relay a valid authorization. The factory and relayer have no permission over vault funds.
contract PactEventVaultFactory is EIP712 {
    bytes32 public constant AUTHORIZATION_TYPEHASH = keccak256(
        "EventVaultAuthorization(bytes32 eventId,address organizer,uint64 deadline)"
    );

    address public immutable agreementRegistry;
    address public immutable settlementToken;
    mapping(bytes32 => address) public eventVaults;

    error InvalidInput();
    error InvalidSignature();
    error AuthorizationExpired();
    error EventVaultAlreadyExists();

    event EventVaultCreated(bytes32 indexed eventId, address indexed organizer, address indexed vault);

    constructor(address registry_, address token_) EIP712("PactEventVaultFactory", "1") {
        if (registry_ == address(0) || token_ == address(0)) revert InvalidInput();
        agreementRegistry = registry_;
        settlementToken = token_;
    }

    function createEventVault(bytes32 eventId, address organizer, uint64 deadline, bytes calldata organizerSignature)
        external returns (address vault)
    {
        if (eventId == bytes32(0) || organizer == address(0)) revert InvalidInput();
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (eventVaults[eventId] != address(0)) revert EventVaultAlreadyExists();
        bytes32 digest = authorizationDigest(eventId, organizer, deadline);
        if (ECDSA.recover(digest, organizerSignature) != organizer) revert InvalidSignature();
        vault = address(new PactEventVault{salt: eventId}(eventId, organizer, agreementRegistry, settlementToken));
        eventVaults[eventId] = vault;
        emit EventVaultCreated(eventId, organizer, vault);
    }

    function authorizationDigest(bytes32 eventId, address organizer, uint64 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(AUTHORIZATION_TYPEHASH, eventId, organizer, deadline)));
    }

    function predictEventVault(bytes32 eventId, address organizer) external view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(PactEventVault).creationCode,
                abi.encode(eventId, organizer, agreementRegistry, settlementToken)
            )
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), eventId, bytecodeHash)))));
    }
}
