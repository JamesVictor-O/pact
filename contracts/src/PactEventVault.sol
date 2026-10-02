// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPactAgreementRegistry} from "./PactTreasury.sol";

/// @notice A permanent USDC escrow for one Pact event.
/// @dev Sponsors may transfer the settlement token directly to this address. Only organizer-signed
///      instructions can allocate, release, or refund funds; a relayer never receives custody authority.
contract PactEventVault is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

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
        "EventAllocation(bytes32 agreementId,bytes32 paymentId,uint256 amount,uint256 nonce,uint64 deadline)"
    );
    bytes32 public constant RELEASE_TYPEHASH = keccak256(
        "EventPaymentRelease(bytes32 agreementId,bytes32 paymentId,address payoutAddress,uint256 amount,uint256 nonce,uint64 deadline)"
    );
    bytes32 public constant ROUTE_TYPEHASH = keccak256(
        "EventPaymentRoute(bytes32 agreementId,bytes32 paymentId,bytes32 routeId,address depositAddress,uint256 amount,uint256 nonce,uint64 deadline)"
    );
    bytes32 public constant REFUND_TYPEHASH = keccak256(
        "EventRefund(bytes32 fundingReceiptId,address recipient,uint256 amount,uint256 nonce,uint64 deadline)"
    );

    bytes32 public immutable eventId;
    address public immutable organizer;
    IERC20 public immutable settlementToken;
    IPactAgreementRegistry public immutable agreementRegistry;
    uint256 public immutable settlementUnit;

    uint256 public allocatedTotal;
    uint256 public organizerNonce;
    mapping(bytes32 => uint256) public paymentAllocated;
    mapping(bytes32 => uint256) public paymentPaid;
    mapping(bytes32 => uint256) public agreementAllocated;
    mapping(bytes32 => uint256) public agreementPaid;
    mapping(bytes32 => uint256) public paymentRouting;
    mapping(bytes32 => uint256) public agreementRouting;
    mapping(bytes32 => uint256) public routeAmount;
    mapping(bytes32 => bytes32) public paymentAgreement;
    mapping(bytes32 => uint256) public refundedByReceipt;

    error InvalidInput();
    error InvalidAmount();
    error InvalidAgreement();
    error InvalidSignature();
    error AuthorizationExpired();
    error InsufficientAvailable();
    error InsufficientAllocation();
    error AgreementLimitExceeded();

    event FundsAllocated(bytes32 indexed agreementId, bytes32 indexed paymentId, uint256 amount);
    event PaymentReleased(bytes32 indexed agreementId, bytes32 indexed paymentId, address indexed payoutAddress, uint256 amount);
    event PaymentRouted(bytes32 indexed agreementId, bytes32 indexed paymentId, bytes32 indexed routeId, address depositAddress, uint256 amount);
    event FundingRefunded(bytes32 indexed fundingReceiptId, address indexed recipient, uint256 amount);

    constructor(bytes32 eventId_, address organizer_, address registry_, address token_) EIP712("PactEventVault", "1") {
        if (eventId_ == bytes32(0) || organizer_ == address(0) || registry_ == address(0) || token_ == address(0)) {
            revert InvalidInput();
        }
        eventId = eventId_;
        organizer = organizer_;
        agreementRegistry = IPactAgreementRegistry(registry_);
        settlementToken = IERC20(token_);
        uint8 decimals = IERC20Metadata(token_).decimals();
        if (decimals < 2 || decimals > 18) revert InvalidInput();
        settlementUnit = 10 ** (decimals - 2);
    }

    /// @notice Unallocated token balance. Plain ERC-20 transfers are immediately reflected here.
    function availableBalance() public view returns (uint256) {
        uint256 balance = settlementToken.balanceOf(address(this));
        return balance > allocatedTotal ? balance - allocatedTotal : 0;
    }

    function allocate(
        bytes32 agreementId,
        bytes32 paymentId,
        uint256 amount,
        uint256 nonce,
        uint64 deadline,
        bytes calldata organizerSignature
    ) external {
        if (paymentId == bytes32(0)) revert InvalidInput();
        if (amount == 0) revert InvalidAmount();
        (, uint256 agreementTotal) = _activeAgreement(agreementId);
        _authorize(
            nonce,
            deadline,
            keccak256(abi.encode(ALLOCATION_TYPEHASH, agreementId, paymentId, amount, nonce, deadline)),
            organizerSignature
        );
        if (availableBalance() < amount) revert InsufficientAvailable();
        if (agreementAllocated[agreementId] + agreementPaid[agreementId] + agreementRouting[agreementId] + amount > agreementTotal) {
            revert AgreementLimitExceeded();
        }
        bytes32 boundAgreement = paymentAgreement[paymentId];
        if (boundAgreement != bytes32(0) && boundAgreement != agreementId) revert InvalidAgreement();
        paymentAgreement[paymentId] = agreementId;
        allocatedTotal += amount;
        paymentAllocated[paymentId] += amount;
        agreementAllocated[agreementId] += amount;
        emit FundsAllocated(agreementId, paymentId, amount);
    }

    /// @notice Releases allocated USDC to a cross-chain route without claiming destination delivery.
    function routePayment(
        bytes32 agreementId,
        bytes32 paymentId,
        bytes32 routeId,
        address depositAddress,
        uint256 amount,
        uint256 nonce,
        uint64 deadline,
        bytes calldata organizerSignature
    ) external nonReentrant {
        if (paymentId == bytes32(0) || routeId == bytes32(0) || depositAddress == address(0)) revert InvalidInput();
        if (amount == 0 || routeAmount[routeId] != 0) revert InvalidAmount();
        _activeAgreement(agreementId);
        if (paymentAgreement[paymentId] != agreementId) revert InvalidAgreement();
        if (paymentAllocated[paymentId] < amount || allocatedTotal < amount) revert InsufficientAllocation();
        _authorize(
            nonce,
            deadline,
            keccak256(abi.encode(ROUTE_TYPEHASH, agreementId, paymentId, routeId, depositAddress, amount, nonce, deadline)),
            organizerSignature
        );
        paymentAllocated[paymentId] -= amount;
        agreementAllocated[agreementId] -= amount;
        allocatedTotal -= amount;
        paymentRouting[paymentId] += amount;
        agreementRouting[agreementId] += amount;
        routeAmount[routeId] = amount;
        settlementToken.safeTransfer(depositAddress, amount);
        emit PaymentRouted(agreementId, paymentId, routeId, depositAddress, amount);
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
        _activeAgreement(agreementId);
        if (paymentAgreement[paymentId] != agreementId) revert InvalidAgreement();
        if (paymentAllocated[paymentId] < amount || allocatedTotal < amount) revert InsufficientAllocation();
        _authorize(
            nonce,
            deadline,
            keccak256(abi.encode(RELEASE_TYPEHASH, agreementId, paymentId, payoutAddress, amount, nonce, deadline)),
            organizerSignature
        );
        paymentAllocated[paymentId] -= amount;
        agreementAllocated[agreementId] -= amount;
        allocatedTotal -= amount;
        paymentPaid[paymentId] += amount;
        agreementPaid[agreementId] += amount;
        settlementToken.safeTransfer(payoutAddress, amount);
        emit PaymentReleased(agreementId, paymentId, payoutAddress, amount);
    }

    /// @notice Returns unallocated funds to an explicit recipient after organizer authorization.
    /// @dev The receipt reference prevents accidental accounting ambiguity; nonce protection prevents replay.
    function refund(
        bytes32 fundingReceiptId,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint64 deadline,
        bytes calldata organizerSignature
    ) external nonReentrant {
        if (fundingReceiptId == bytes32(0) || recipient == address(0)) revert InvalidInput();
        if (amount == 0) revert InvalidAmount();
        _authorize(
            nonce,
            deadline,
            keccak256(abi.encode(REFUND_TYPEHASH, fundingReceiptId, recipient, amount, nonce, deadline)),
            organizerSignature
        );
        if (availableBalance() < amount) revert InsufficientAvailable();
        refundedByReceipt[fundingReceiptId] += amount;
        settlementToken.safeTransfer(recipient, amount);
        emit FundingRefunded(fundingReceiptId, recipient, amount);
    }

    function allocationDigest(bytes32 agreementId, bytes32 paymentId, uint256 amount, uint256 nonce, uint64 deadline)
        external view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(ALLOCATION_TYPEHASH, agreementId, paymentId, amount, nonce, deadline)));
    }

    function releaseDigest(bytes32 agreementId, bytes32 paymentId, address payoutAddress, uint256 amount, uint256 nonce, uint64 deadline)
        external view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(RELEASE_TYPEHASH, agreementId, paymentId, payoutAddress, amount, nonce, deadline)));
    }

    function routeDigest(bytes32 agreementId, bytes32 paymentId, bytes32 routeId, address depositAddress, uint256 amount, uint256 nonce, uint64 deadline)
        external view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(ROUTE_TYPEHASH, agreementId, paymentId, routeId, depositAddress, amount, nonce, deadline)));
    }

    function refundDigest(bytes32 fundingReceiptId, address recipient, uint256 amount, uint256 nonce, uint64 deadline)
        external view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(REFUND_TYPEHASH, fundingReceiptId, recipient, amount, nonce, deadline)));
    }

    function _activeAgreement(bytes32 agreementId) internal view returns (address payee, uint256 totalAmount) {
        (bool ok, bytes memory result) = address(agreementRegistry).staticcall(
            abi.encodeWithSelector(IPactAgreementRegistry.agreements.selector, agreementId)
        );
        if (!ok || result.length < 320) revert InvalidAgreement();
        RegistryAgreement memory agreement = abi.decode(result, (RegistryAgreement));
        if (agreement.status != 1 || agreement.eventId != eventId || agreement.organizer != organizer || agreement.payee == address(0)) {
            revert InvalidAgreement();
        }
        payee = agreement.payee;
        totalAmount = agreement.totalAmountMinor * settlementUnit;
    }

    function _authorize(uint256 nonce, uint64 deadline, bytes32 structHash, bytes calldata signature) internal {
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (nonce != organizerNonce || ECDSA.recover(_hashTypedDataV4(structHash), signature) != organizer) {
            revert InvalidSignature();
        }
        organizerNonce = nonce + 1;
    }
}
