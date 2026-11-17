-- review_log is append-only (ADR 0002). Only the local synced_at marker may change.
-- Deletes stay allowed so that deleting a card cascades to its logs.
CREATE TRIGGER `review_log_append_only`
BEFORE UPDATE OF `id`, `card_id`, `rating`, `answer`, `latency_ms`, `reviewed_at`, `device_id` ON `review_log`
BEGIN
  SELECT RAISE(ABORT, 'review_log is append-only');
END;
