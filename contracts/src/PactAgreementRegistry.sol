// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract PactAgreementRegistry is EIP712 {
    enum AgreementStatus { None, Active, Cancelled }
    struct Proposal { bytes32 agreementId; bytes32 eventId; address organizer; bytes32 agreementHash; bytes32 scheduleHash; bytes32 currencyCode; uint256 totalAmountMinor; uint64 expiry; }
    struct Agreement { bytes32 eventId; address organizer; address payee; bytes32 agreementHash; bytes32 scheduleHash; bytes32 invoiceHash; bytes32 currencyCode; uint256 totalAmountMinor; uint64 acceptedAt; AgreementStatus status; }

    bytes32 public constant PROPOSAL_TYPEHASH = keccak256("AgreementProposal(bytes32 agreementId,bytes32 eventId,address organizer,bytes32 agreementHash,bytes32 scheduleHash,bytes32 currencyCode,uint256 totalAmountMinor,uint64 expiry)");
    bytes32 public constant ACCEPTANCE_TYPEHASH = keccak256("AgreementAcceptance(bytes32 proposalDigest,address payee,bytes32 invoiceHash)");
    mapping(bytes32 => Agreement) public agreements;

    error InvalidInput(); error ProposalExpired(); error AgreementAlreadyExists(); error InvalidOrganizerSignature(); error InvalidPayeeSignature(); error Unauthorized(); error InvalidStatus();
    event AgreementRegistered(bytes32 indexed agreementId, bytes32 indexed eventId, address indexed organizer, address payee, bytes32 agreementHash, bytes32 invoiceHash);
    event AgreementCancelled(bytes32 indexed agreementId);

    constructor() EIP712("PactAgreementRegistry", "1") {}

    function proposalDigest(Proposal calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PROPOSAL_TYPEHASH, p.agreementId, p.eventId, p.organizer, p.agreementHash, p.scheduleHash, p.currencyCode, p.totalAmountMinor, p.expiry)));
    }

    function acceptanceDigest(bytes32 proposal, address payee, bytes32 invoiceHash) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ACCEPTANCE_TYPEHASH, proposal, payee, invoiceHash)));
    }

    function registerAcceptedAgreement(Proposal calldata p, address payee, bytes32 invoiceHash, bytes calldata organizerSignature, bytes calldata payeeSignature) external {
        if (p.agreementId == 0 || p.eventId == 0 || p.organizer == address(0) || payee == address(0) || p.agreementHash == 0 || p.scheduleHash == 0 || invoiceHash == 0 || p.currencyCode == 0 || p.totalAmountMinor == 0) revert InvalidInput();
        if (block.timestamp > p.expiry) revert ProposalExpired();
        if (agreements[p.agreementId].status != AgreementStatus.None) revert AgreementAlreadyExists();
        bytes32 proposalHash = proposalDigest(p);
        if (ECDSA.recover(proposalHash, organizerSignature) != p.organizer) revert InvalidOrganizerSignature();
        if (ECDSA.recover(acceptanceDigest(proposalHash, payee, invoiceHash), payeeSignature) != payee) revert InvalidPayeeSignature();
        agreements[p.agreementId] = Agreement(p.eventId, p.organizer, payee, p.agreementHash, p.scheduleHash, invoiceHash, p.currencyCode, p.totalAmountMinor, uint64(block.timestamp), AgreementStatus.Active);
        emit AgreementRegistered(p.agreementId, p.eventId, p.organizer, payee, p.agreementHash, invoiceHash);
    }

    function cancelAgreement(bytes32 agreementId) external {
        Agreement storage agreement = agreements[agreementId];
        if (agreement.status != AgreementStatus.Active) revert InvalidStatus();
        if (msg.sender != agreement.organizer) revert Unauthorized();
        agreement.status = AgreementStatus.Cancelled;
        emit AgreementCancelled(agreementId);
    }
}
