-- =============================================================================
-- Migration 0022 — Transport: the conductor/driver staff role
--
-- ALONE IN ITS OWN MIGRATION ON PURPOSE. Postgres will not let a newly added
-- enum value be *used* in the same transaction that adds it, and each migration
-- file is applied as one transaction. So the value lands here and everything
-- that references it starts at 0023.
-- =============================================================================

alter type staff_role add value if not exists 'transport';
