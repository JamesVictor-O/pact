// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPactAgreementRegistry {
    function agreements(bytes32 agreementId) external view returns (
        bytes32 eventId,
        address organizer,
        address payee,
        bytes32 agreementHash,
        bytes32 scheduleHash,
        bytes32 invoiceHash,
        bytes32 currencyCode,
        uint256 totalAmountMinor,
        uint64 acceptedAt,
        uint8 status
    );
}

/// @notice Event-scoped escrow for one settlement token. Human-readable and PII data stays offchain.
/// @dev Anyone can submit organizer-signed allocation and release instructions. The relayer has no custody authority.
contract PactTreasury is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct FundingRequest {
        bytes32 eventId;
        address contributor;
        uint256 received;
        uint256 available;
        uint256 refunded;
    }

    struct RegistryAgreement {
        bytes32 eventId;
        address organizer;
        address payee;
        bytes32 agreementHash;
        bytes32 scheduleHash;
        bytes32 invoiceHash;
        bytes32 currencyCode;
        uint256 totalAmountMinor;
        uint64 acceptedAt;
        uint8 status;
    }

    bytes32 public constant ALLOCATION_TYPEHASH = keccak256(
        "Allocation(bytes32 agreementId,bytes32 paymentId,bytes32 fundingRequestId,uint256 amount,uint256 nonce,uint64 deadline)"
    );
    bytes32 public constant RELEASE_TYPEHASH = keccak256(
        "PaymentRelease(bytes32 agreementId,bytes32 paymentId,address payoutAddress,uint256 amount,uint256 nonce,uint64 deadline)"
    );

    IERC20 public immutable settlementToken;
    IPactAgreementRegistry public immutable agreementRegistry;
    uint256 public immutable settlementUnit;

    mapping(bytes32 => FundingRequest) public fundingRequests;
    mapping(bytes32 => uint256) public eventAvailable;
    mapping(bytes32 => uint256) public eventAllocated;
    mapping(bytes32 => uint256) public paymentAllocated;
    mapping(bytes32 => uint256) public paymentPaid;
    mapping(bytes32 => uint256) public agreementAllocated;
    mapping(bytes32 => uint256) public agreementPaid;
    mapping(bytes32 => bytes32) public paymentAgreement;
    mapping(address => uint256) public organizerNonces;

    error InvalidInput();
    error InvalidAmount();
    error InvalidAgreement();
    error InvalidSignature();
    error AuthorizationExpired();
    error ContributorMismatch();
    error InsufficientAvailable();
    error InsufficientAllocation();
    error AgreementLimitExceeded();

    event FundingReceived(bytes32 indexed eventId, bytes32 indexed fundingRequestId, address indexed contributor, uint256 amount);
    event FundsAllocated(bytes32 indexed eventId, bytes32 indexed paymentId, bytes32 indexed fundingRequestId, bytes32 agreementId, uint256 amount);
    event PaymentReleased(bytes32 indexed eventId, bytes32 indexed paymentId, bytes32 indexed agreementId, address payoutAddress, uint256 amount);
    event FundingRefunded(bytes32 indexed eventId, bytes32 indexed fundingRequestId, address indexed contributor, uint256 amount);

    constructor(address registry, address token) EIP712("PactTreasury", "1") {
        if (registry == address(0) || token == address(0)) revert InvalidInput();
        agreementRegistry = IPactAgreementRegistry(registry);
        settlementToken = IERC20(token);
        uint8 decimals = IERC20Metadata(token).decimals();
        if (decimals < 2 || decimals > 18) revert InvalidInput();
        settlementUnit = 10 ** (decimals - 2);
    }

    function fund(bytes32 eventId, bytes32 fundingRequestId, uint256 amount) external nonReentrant {
        if (eventId == bytes32(0) || fundingRequestId == bytes32(0)) revert InvalidInput();
        if (amount == 0) revert InvalidAmount();
        FundingRequest storage request = fundingRequests[fundingRequestId];
        if (request.eventId == bytes32(0)) {
            request.eventId = eventId;
            request.contributor = msg.sender;
        } else if (request.eventId != eventId) {
            revert InvalidInput();
        } else if (request.contributor != msg.sender) {
            revert ContributorMismatch();
        }
        request.received += amount;
        request.available += amount;
        eventAvailable[eventId] += amount;
        uint256 balanceBefore = settlementToken.balanceOf(address(this));
        settlementToken.safeTransferFrom(msg.sender, address(this), amount);
        if (settlementToken.balanceOf(address(this)) - balanceBefore != amount) revert InvalidAmount();
        emit FundingReceived(eventId, fundingRequestId, msg.sender, amount);
    }

    function allocate(
        bytes32 agreementId,
        bytes32 paymentId,
        bytes32 fundingRequestId,
        uint256 amount,
        uint256 nonce,
        uint64 deadline,
        bytes calldata organizerSignature
    ) external {
        if (paymentId == bytes32(0) || fundingRequestId == bytes32(0)) revert InvalidInput();
        if (amount == 0) revert InvalidAmount();
        bytes32 eventId;
        {
        address organizer;
        uint256 agreementTotal;
        (eventId, organizer, agreementTotal) = _activeAgreement(agreementId);
        if (block.timestamp > deadline) revert AuthorizationExpired();
        _authorize(
            organizer,
            nonce,
            keccak256(abi.encode(ALLOCATION_TYPEHASH, agreementId, paymentId, fundingRequestId, amount, nonce, deadline)),
            organizerSignature
        );
        _ensureAgreementCapacity(agreementId, amount, agreementTotal);
        }
        FundingRequest storage request = fundingRequests[fundingRequestId];
        if (request.eventId != eventId) revert InvalidInput();
        if (request.available < amount || eventAvailable[eventId] < amount) revert InsufficientAvailable();
        bytes32 boundAgreement = paymentAgreement[paymentId];
        if (boundAgreement != bytes32(0) && boundAgreement != agreementId) revert InvalidAgreement();
        paymentAgreement[paymentId] = agreementId;
        request.available -= amount;
        eventAvailable[eventId] -= amount;
        eventAllocated[eventId] += amount;
        paymentAllocated[paymentId] += amount;
        agreementAllocated[agreementId] += amount;
        emit FundsAllocated(eventId, paymentId, fundingRequestId, agreementId, amount);
    }

    function release(
        bytes32 agreementId,
        bytes32 paymentId,
        address payoutAddress,
        uint256 amount,
        uint256 nonce,
        uint64 deadline,
        bytes calldata organizerSignature
    ) external nonReentrant {
        if (paymentId == bytes32(0) || payoutAddress == address(0)) revert InvalidInput();
        if (amount == 0) revert InvalidAmount();
        (bytes32 eventId, address organizer,) = _activeAgreement(agreementId);
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (paymentAgreement[paymentId] != agreementId) revert InvalidAgreement();
        if (paymentAllocated[paymentId] < amount || eventAllocated[eventId] < amount) revert InsufficientAllocation();
        _authorize(
            organizer,
            nonce,
            keccak256(abi.encode(RELEASE_TYPEHASH, agreementId, paymentId, payoutAddress, amount, nonce, deadline)),
            organizerSignature
        );
        paymentAllocated[paymentId] -= amount;
        eventAllocated[eventId] -= amount;
        agreementAllocated[agreementId] -= amount;
        agreementPaid[agreementId] += amount;
        paymentPaid[paymentId] += amount;
        settlementToken.safeTransfer(payoutAddress, amount);
        emit PaymentReleased(eventId, paymentId, agreementId, payoutAddress, amount);
    }

    /// @notice Contributors may recover only funds from their request that have not been allocated.
    function refund(bytes32 fundingRequestId, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        FundingRequest storage request = fundingRequests[fundingRequestId];
        if (request.contributor != msg.sender) revert ContributorMismatch();
        if (request.available < amount || eventAvailable[request.eventId] < amount) revert InsufficientAvailable();
        request.available -= amount;
        request.refunded += amount;
        eventAvailable[request.eventId] -= amount;
        settlementToken.safeTransfer(msg.sender, amount);
        emit FundingRefunded(request.eventId, fundingRequestId, msg.sender, amount);
    }

    function allocationDigest(
        bytes32 agreementId,
        bytes32 paymentId,
        bytes32 fundingRequestId,
        uint256 amount,
        uint256 nonce,
        uint64 deadline
    ) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ALLOCATION_TYPEHASH, agreementId, paymentId, fundingRequestId, amount, nonce, deadline)));
    }

    function releaseDigest(
        bytes32 agreementId,
        bytes32 paymentId,
        address payoutAddress,
        uint256 amount,
        uint256 nonce,
        uint64 deadline
    ) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RELEASE_TYPEHASH, agreementId, paymentId, payoutAddress, amount, nonce, deadline)));
    }

    function _activeAgreement(bytes32 agreementId) internal view returns (bytes32 eventId, address organizer, uint256 totalAmount) {
        (bool ok, bytes memory result) = address(agreementRegistry).staticcall(
            abi.encodeWithSelector(IPactAgreementRegistry.agreements.selector, agreementId)
        );
        if (!ok || result.length < 320) revert InvalidAgreement();
        RegistryAgreement memory agreement = abi.decode(result, (RegistryAgreement));
        eventId = agreement.eventId;
        organizer = agreement.organizer;
        totalAmount = agreement.totalAmountMinor;
        if (agreement.status != 1 || eventId == bytes32(0) || organizer == address(0)) revert InvalidAgreement();
    }

    function _authorize(address organizer, uint256 nonce, bytes32 structHash, bytes calldata signature) internal {
        if (nonce != organizerNonces[organizer]) revert InvalidSignature();
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != organizer) revert InvalidSignature();
        organizerNonces[organizer] = nonce + 1;
    }

    function _ensureAgreementCapacity(bytes32 agreementId, uint256 amount, uint256 agreementTotalMinor) internal view {
        if (agreementAllocated[agreementId] + agreementPaid[agreementId] + amount > agreementTotalMinor * settlementUnit) {
            revert AgreementLimitExceeded();
        }
    }
}
