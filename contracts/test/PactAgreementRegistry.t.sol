// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PactAgreementRegistry} from "../src/PactAgreementRegistry.sol";

contract PactAgreementRegistryTest is Test {
    PactAgreementRegistry registry;
    uint256 organizerKey = 0xA11CE; uint256 payeeKey = 0xB0B; address organizer; address payee; address relayer = address(0xCAFE);
    bytes32 invoiceHash = keccak256("invoice");

    function setUp() public { registry = new PactAgreementRegistry(); organizer = vm.addr(organizerKey); payee = vm.addr(payeeKey); }
    function proposal() internal view returns (PactAgreementRegistry.Proposal memory) { return PactAgreementRegistry.Proposal(keccak256("agreement"), keccak256("event"), organizer, keccak256("terms"), keccak256("schedule"), bytes32("USD"), 400000, uint64(block.timestamp + 1 days)); }
    function signatures(PactAgreementRegistry.Proposal memory p) internal view returns (bytes memory os, bytes memory ps) { bytes32 pd = registry.proposalDigest(p); (uint8 v, bytes32 r, bytes32 s) = vm.sign(organizerKey, pd); os = abi.encodePacked(r,s,v); (v,r,s) = vm.sign(payeeKey, registry.acceptanceDigest(pd, payee, invoiceHash)); ps = abi.encodePacked(r,s,v); }
    function register() internal { PactAgreementRegistry.Proposal memory p = proposal(); (bytes memory os, bytes memory ps) = signatures(p); vm.prank(relayer); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); }

    function testRelayerRegistersValidSignaturesAndStoresHashes() public { PactAgreementRegistry.Proposal memory p=proposal(); (bytes memory os,bytes memory ps)=signatures(p); vm.expectEmit(true,true,true,true); emit PactAgreementRegistry.AgreementRegistered(p.agreementId,p.eventId,organizer,payee,p.agreementHash,invoiceHash); vm.prank(relayer); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); (bytes32 eventId,address storedOrganizer,address storedPayee,bytes32 agreementHash,bytes32 scheduleHash,bytes32 storedInvoice,,,,PactAgreementRegistry.AgreementStatus status)=registry.agreements(p.agreementId); assertEq(eventId,p.eventId); assertEq(storedOrganizer,organizer); assertEq(storedPayee,payee); assertEq(agreementHash,p.agreementHash); assertEq(scheduleHash,p.scheduleHash); assertEq(storedInvoice,invoiceHash); assertEq(uint(status),uint(PactAgreementRegistry.AgreementStatus.Active)); }
    function testInvalidOrganizerSignatureFails() public { PactAgreementRegistry.Proposal memory p=proposal(); (,bytes memory ps)=signatures(p); (uint8 v,bytes32 r,bytes32 s)=vm.sign(payeeKey,registry.proposalDigest(p)); vm.expectRevert(PactAgreementRegistry.InvalidOrganizerSignature.selector); registry.registerAcceptedAgreement(p,payee,invoiceHash,abi.encodePacked(r,s,v),ps); }
    function testInvalidPayeeSignatureFails() public { PactAgreementRegistry.Proposal memory p=proposal(); (bytes memory os,)=signatures(p); (uint8 v,bytes32 r,bytes32 s)=vm.sign(organizerKey,registry.acceptanceDigest(registry.proposalDigest(p),payee,invoiceHash)); vm.expectRevert(PactAgreementRegistry.InvalidPayeeSignature.selector); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,abi.encodePacked(r,s,v)); }
    function testExpiredDuplicateAndZeroPayeeFail() public { PactAgreementRegistry.Proposal memory p=proposal(); (bytes memory os,bytes memory ps)=signatures(p); vm.warp(p.expiry+1); vm.expectRevert(PactAgreementRegistry.ProposalExpired.selector); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); vm.warp(1); p=proposal(); (os,ps)=signatures(p); vm.expectRevert(PactAgreementRegistry.InvalidInput.selector); registry.registerAcceptedAgreement(p,address(0),invoiceHash,os,ps); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); vm.expectRevert(PactAgreementRegistry.AgreementAlreadyExists.selector); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); }
    function testOnlyOrganizerCanCancelAndCannotCancelTwice() public { register(); bytes32 id=proposal().agreementId; vm.prank(relayer); vm.expectRevert(PactAgreementRegistry.Unauthorized.selector); registry.cancelAgreement(id); vm.prank(organizer); registry.cancelAgreement(id); vm.prank(organizer); vm.expectRevert(PactAgreementRegistry.InvalidStatus.selector); registry.cancelAgreement(id); }
    function testZeroTotalFails() public { PactAgreementRegistry.Proposal memory p=proposal(); p.totalAmountMinor=0; (bytes memory os,bytes memory ps)=signatures(p); vm.expectRevert(PactAgreementRegistry.InvalidInput.selector); registry.registerAcceptedAgreement(p,payee,invoiceHash,os,ps); }
}
