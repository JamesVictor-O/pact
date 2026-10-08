begin;

-- Cross-chain swaps can settle with precision below one USD cent. The exact
-- amount remains in amount_atomic; amount_minor is the safely creditable
-- whole-cent portion and may therefore be zero for a very small receipt.
alter table funding_receipts
  drop constraint if exists funding_receipts_amount_minor_check;

alter table funding_receipts
  add constraint funding_receipts_amount_minor_check check (amount_minor >= 0);

commit;
