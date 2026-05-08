/**
 * Memory policy constants.
 *
 * Single source of truth for all memory size constraints across
 * the Avatar assembler, Game Master, admin inspection, and maintenance flows.
 */

/** Number of recent exchanges retained in short-term memory for Avatar and GM. */
export const MEMORY_SHORT_TERM_EXCHANGE_LIMIT = 2

/** Maximum long-term facts injected into Avatar/GM context per turn. */
export const MEMORY_LONG_TERM_FACT_LIMIT = 10

/** Maximum episodic memories selected for turn-time context. */
export const MEMORY_EPISODIC_SELECTION_LIMIT = 3

/** Number of candidate episodic memories fetched before selection scoring. */
export const MEMORY_EPISODIC_RETRIEVAL_LIMIT = 12

/** Default cap for long-term facts returned in admin inspection responses. */
export const ADMIN_LONG_TERM_FACT_DEFAULT_LIMIT = 50

/** Number of raw messages fetched to build short-term exchange windows. */
export const MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT = 20

/** Number of recent dialogue messages retained in the session working summary. */
export const WORKING_MEMORY_SESSION_RECENT_MESSAGE_LIMIT = 6

/** Number of recent dialogue messages retained in the avatar working summary. */
export const WORKING_MEMORY_AVATAR_RECENT_MESSAGE_LIMIT = 4

/** Maximum character count per message snippet inside working summaries. */
export const WORKING_MEMORY_SNIPPET_MAX_LENGTH = 220
