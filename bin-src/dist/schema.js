/**
 * MACS Protocol v4.1 — Type Definitions
 *
 * Core principle: Append-only JSONL events → rebuildable state → auto-generated Markdown
 * All timestamps are ISO 8601. All IDs are prefixed (T-, C-, E-, MSG-).
 */
/** Current spec version — written into every event for forward compatibility */
export const MACS_SPEC_VERSION = '4.1';
