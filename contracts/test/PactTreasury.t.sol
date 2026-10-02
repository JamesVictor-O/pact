// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PactAgreementRegistry} from "../src/PactAgreementRegistry.sol";
import {PactTreasury} from "../src/PactTreasury.sol";

contract TestSettlementToken is ERC20 {
    constructor() ERC20("Test USD", "TUSD") {}
    function mint(address account, uint256 amount) external { _mint(account, amount); }
}

contract PactTreasuryTest is Test {
    PactAgreementRegistry registry;
    PactTreasury treasury;
    TestSettlementToken token;

    uint256 organizerKey = 0xA11CE;
    uint256 payeeKey = 0xB0B;
    address organizer;
    address payee;
    address contributor = address(0xF00D);
    address relayer = address(0xCAFE);
    bytes32 agreementId = keccak256("agreement");
    bytes32 eventId = keccak256("event");
    bytes32 requestId = keccak256("request");
    bytes32 paymentId = keccak256("payment");
    bytes32 invoiceHash = keccak256("invoice");

    function setUp() public {
        registry = new PactAgreementRegistry();
        token = new TestSettlementToken();
        treasury = new PactTreasury(address(registry), address(token));
        organizer = vm.addr(organizerKey);
        payee = vm.addr(payeeKey);
        _registerAgreement();
        token.mint(contributor, 10_000_000);
        vm.prank(contributor);
        token.approve(address(treasury), type(uint256).max);
    }

    function _proposal() internal view returns (PactAgreementRegistry.Proposal memory) {
        return PactAgreementRegistry.Proposal(agreementId, eventId, organizer, keccak256("terms"), keccak256("schedule"), bytes32("USD"), 4_000_00, uint64(block.timestamp + 1 days));
    }

    function _registerAgreement() internal {
        PactAgreementRegistry.Proposal memory p = _proposal();
        bytes32 proposalHash = registry.proposalDigest(p);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(organizerKey, proposalHash);
        bytes memory organizerSignature = abi.encodePacked(r, s, v);
        (v, r, s) = vm.sign(payeeKey, registry.acceptanceDigest(proposalHash, payee, invoiceHash));
        registry.registerAcceptedAgreement(p, payee, invoiceHash, organizerSignature, abi.encodePacked(r, s, v));
    }

    function _fund(uint256 amount) internal {
        vm.prank(contributor);
        treasury.fund(eventId, requestId, amount);
    }

    function _allocationSignature(uint256 amount, uint256 nonce, uint64 deadline) internal view returns (bytes memory) {
        bytes32 digest = treasury.allocationDigest(agreementId, paymentId, requestId, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(organizerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _releaseSignature(address destination, uint256 amount, uint256 nonce, uint64 deadline) internal view returns (bytes memory) {
        bytes32 digest = treasury.releaseDigest(agreementId, paymentId, destination, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(organizerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function testFundingCreditsOnlyTheRequestedEvent() public {
        _fund(2_000_000);
        (bytes32 storedEvent, address storedContributor, uint256 received, uint256 available, uint256 refunded) = treasury.fundingRequests(requestId);
        assertEq(storedEvent, eventId);
        assertEq(storedContributor, contributor);
        assertEq(received, 2_000_000);
        assertEq(available, 2_000_000);
        assertEq(refunded, 0);
        assertEq(treasury.eventAvailable(eventId), 2_000_000);
        assertEq(token.balanceOf(address(treasury)), 2_000_000);
    }

    function testRelayerCanAllocateAndReleaseButCannotFabricateAuthority() public {
        _fund(2_000_000);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(relayer);
        treasury.allocate(agreementId, paymentId, requestId, 1_000_000, 0, deadline, _allocationSignature(1_000_000, 0, deadline));
        assertEq(treasury.paymentAllocated(paymentId), 1_000_000);
        assertEq(treasury.eventAvailable(eventId), 1_000_000);

        vm.prank(relayer);
        treasury.release(agreementId, paymentId, payee, 600_000, 1, deadline, _releaseSignature(payee, 600_000, 1, deadline));
        assertEq(token.balanceOf(payee), 600_000);
        assertEq(treasury.paymentAllocated(paymentId), 400_000);
        assertEq(treasury.paymentPaid(paymentId), 600_000);

        bytes memory forged = _releaseSignature(payee, 1, 2, deadline);
        forged[10] = bytes1(uint8(forged[10]) ^ 1);
        vm.prank(relayer);
        vm.expectRevert();
        treasury.release(agreementId, paymentId, payee, 1, 2, deadline, forged);
    }

    function testCannotOverAllocateOrReleaseAndNonceCannotReplay() public {
        _fund(1_000_000);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _allocationSignature(1_000_000, 0, deadline);
        treasury.allocate(agreementId, paymentId, requestId, 1_000_000, 0, deadline, signature);
        bytes memory releaseSignature = _releaseSignature(payee, 1_000_001, 1, deadline);
        vm.expectRevert(PactTreasury.InvalidSignature.selector);
        treasury.allocate(agreementId, paymentId, requestId, 1_000_000, 0, deadline, signature);

        vm.expectRevert(PactTreasury.InsufficientAllocation.selector);
        treasury.release(agreementId, paymentId, payee, 1_000_001, 1, deadline, releaseSignature);
    }

    function testContributorCanRefundOnlyUnallocatedFunds() public {
        _fund(2_000_000);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        treasury.allocate(agreementId, paymentId, requestId, 1_500_000, 0, deadline, _allocationSignature(1_500_000, 0, deadline));
        vm.prank(contributor);
        treasury.refund(requestId, 500_000);
        assertEq(token.balanceOf(contributor), 8_500_000);
        assertEq(treasury.eventAvailable(eventId), 0);
        vm.prank(contributor);
        vm.expectRevert(PactTreasury.InsufficientAvailable.selector);
        treasury.refund(requestId, 1);
    }

    function testAllocationCannotExceedRegisteredAgreementTotal() public {
        uint256 overAgreementTotal = 400_001 * treasury.settlementUnit();
        token.mint(contributor, overAgreementTotal);
        _fund(overAgreementTotal);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _allocationSignature(overAgreementTotal, 0, deadline);
        vm.expectRevert(PactTreasury.AgreementLimitExceeded.selector);
        treasury.allocate(agreementId, paymentId, requestId, overAgreementTotal, 0, deadline, signature);
    }

    function testAnotherContributorCannotTopUpOrRefundARequest() public {
        _fund(100);
        address attacker = address(0xBAD);
        token.mint(attacker, 100);
        vm.startPrank(attacker);
        token.approve(address(treasury), 100);
        vm.expectRevert(PactTreasury.ContributorMismatch.selector);
        treasury.fund(eventId, requestId, 100);
        vm.expectRevert(PactTreasury.ContributorMismatch.selector);
        treasury.refund(requestId, 1);
        vm.stopPrank();
    }

    function testCancelledAgreementCannotAllocateOrRelease() public {
        vm.prank(organizer);
        registry.cancelAgreement(agreementId);
        _fund(100);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory signature = _allocationSignature(100, 0, deadline);
        vm.expectRevert(PactTreasury.InvalidAgreement.selector);
        treasury.allocate(agreementId, paymentId, requestId, 100, 0, deadline, signature);
    }
}
