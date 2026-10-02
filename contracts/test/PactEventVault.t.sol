// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PactAgreementRegistry} from "../src/PactAgreementRegistry.sol";
import {PactEventVault} from "../src/PactEventVault.sol";
import {PactEventVaultFactory} from "../src/PactEventVaultFactory.sol";

contract VaultTestToken is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address account, uint256 amount) external { _mint(account, amount); }
}

contract PactEventVaultTest is Test {
    PactAgreementRegistry registry;
    PactEventVaultFactory factory;
    PactEventVault vault;
    VaultTestToken token;

    uint256 organizerKey = 0xA11CE;
    uint256 payeeKey = 0xB0B;
    address organizer;
    address payee;
    address sponsor = address(0xF00D);
    address relayer = address(0xCAFE);
    bytes32 eventId = keccak256("event");
    bytes32 agreementId = keccak256("agreement");
    bytes32 paymentId = keccak256("payment");

    function setUp() public {
        registry = new PactAgreementRegistry();
        token = new VaultTestToken();
        factory = new PactEventVaultFactory(address(registry), address(token));
        organizer = vm.addr(organizerKey);
        payee = vm.addr(payeeKey);
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes memory signature = _sign(organizerKey, factory.authorizationDigest(eventId, organizer, deadline));
        vm.prank(relayer);
        vault = PactEventVault(factory.createEventVault(eventId, organizer, deadline, signature));
        _registerAgreement();
        token.mint(sponsor, 10_000e6);
    }

    function testCreatesDeterministicEventVaultFromOrganizerAuthorization() public view {
        assertEq(factory.eventVaults(eventId), address(vault));
        assertEq(factory.predictEventVault(eventId, organizer), address(vault));
        assertEq(vault.eventId(), eventId);
        assertEq(vault.organizer(), organizer);
    }

    function testRejectsForgedOrDuplicateVaultCreation() public {
        bytes32 secondEvent = keccak256("second-event");
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes memory forged = _sign(payeeKey, factory.authorizationDigest(secondEvent, organizer, deadline));
        vm.expectRevert(PactEventVaultFactory.InvalidSignature.selector);
        factory.createEventVault(secondEvent, organizer, deadline, forged);

        bytes memory valid = _sign(organizerKey, factory.authorizationDigest(eventId, organizer, deadline));
        vm.expectRevert(PactEventVaultFactory.EventVaultAlreadyExists.selector);
        factory.createEventVault(eventId, organizer, deadline, valid);
    }

    function testPlainTransferFundsTheEventWithoutWalletConnection() public {
        vm.prank(sponsor);
        token.transfer(address(vault), 2_000e6);
        assertEq(vault.availableBalance(), 2_000e6);
        assertEq(token.balanceOf(address(vault)), 2_000e6);
    }

    function testRelayerCanAllocateAndReleaseOnlyWithOrganizerSignatures() public {
        vm.prank(sponsor);
        token.transfer(address(vault), 2_000e6);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory allocation = _sign(
            organizerKey,
            vault.allocationDigest(agreementId, paymentId, 1_000e6, 0, deadline)
        );
        vm.prank(relayer);
        vault.allocate(agreementId, paymentId, 1_000e6, 0, deadline, allocation);
        assertEq(vault.availableBalance(), 1_000e6);
        assertEq(vault.paymentAllocated(paymentId), 1_000e6);

        bytes memory release = _sign(
            organizerKey,
            vault.releaseDigest(agreementId, paymentId, payee, 600e6, 1, deadline)
        );
        vm.prank(relayer);
        vault.release(agreementId, paymentId, payee, 600e6, 1, deadline, release);
        assertEq(token.balanceOf(payee), 600e6);
        assertEq(vault.paymentAllocated(paymentId), 400e6);
        assertEq(vault.paymentPaid(paymentId), 600e6);
    }

    function testCannotAllocateAnotherEventsAgreement() public {
        vm.prank(sponsor);
        token.transfer(address(vault), 100e6);
        bytes32 otherAgreement = keccak256("other-agreement");
        _registerAgreement(otherAgreement, keccak256("other-event"));
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _sign(
            organizerKey,
            vault.allocationDigest(otherAgreement, paymentId, 100e6, 0, deadline)
        );
        vm.expectRevert(PactEventVault.InvalidAgreement.selector);
        vault.allocate(otherAgreement, paymentId, 100e6, 0, deadline, signature);
    }

    function testOrganizerCanAuthorizeRefundOfOnlyUnallocatedFunds() public {
        vm.prank(sponsor);
        token.transfer(address(vault), 1_000e6);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 receiptId = keccak256("receipt");
        bytes memory signature = _sign(
            organizerKey,
            vault.refundDigest(receiptId, sponsor, 250e6, 0, deadline)
        );
        vm.prank(relayer);
        vault.refund(receiptId, sponsor, 250e6, 0, deadline, signature);
        assertEq(vault.refundedByReceipt(receiptId), 250e6);
        assertEq(vault.availableBalance(), 750e6);
    }

    function testCancelledAgreementCannotAllocate() public {
        vm.prank(organizer);
        registry.cancelAgreement(agreementId);
        vm.prank(sponsor);
        token.transfer(address(vault), 100e6);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _sign(
            organizerKey,
            vault.allocationDigest(agreementId, paymentId, 100e6, 0, deadline)
        );
        vm.expectRevert(PactEventVault.InvalidAgreement.selector);
        vault.allocate(agreementId, paymentId, 100e6, 0, deadline, signature);
    }

    function _registerAgreement() internal { _registerAgreement(agreementId, eventId); }

    function _registerAgreement(bytes32 id, bytes32 targetEvent) internal {
        PactAgreementRegistry.Proposal memory proposal = PactAgreementRegistry.Proposal(
            id,
            targetEvent,
            organizer,
            keccak256(abi.encode("terms", id)),
            keccak256(abi.encode("schedule", id)),
            bytes32("USD"),
            4_000_00,
            uint64(block.timestamp + 1 days)
        );
        bytes32 proposalHash = registry.proposalDigest(proposal);
        bytes32 invoiceHash = keccak256(abi.encode("invoice", id));
        registry.registerAcceptedAgreement(
            proposal,
            payee,
            invoiceHash,
            _sign(organizerKey, proposalHash),
            _sign(payeeKey, registry.acceptanceDigest(proposalHash, payee, invoiceHash))
        );
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
