-- Session invalidation that reaches access tokens.
--
-- Two gaps, both found by probing a running server:
--
-- 1. Signing out revoked refresh tokens and left the access token valid for
--    its full fifteen minutes. On a shared machine that is fifteen minutes of
--    somebody else's recovery record after they thought they had left.
--
-- 2. A completed password reset had the same hole, and there it is worse: the
--    reason a person resets their password is usually that they believe
--    somebody else is in their account. Keeping that person's access token
--    alive is the opposite of what the reset was for.
--
-- A stateless JWT cannot be recalled, so the token carries a version and the
-- server checks it. Bumping the column invalidates every access token issued
-- before the bump, immediately, without a denylist to keep or expire.

ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;

-- Refresh token reuse detection.
--
-- Rotation already meant a stolen token worked once. What was missing was the
-- consequence: replaying a token that has already been consumed is proof that
-- two parties hold it, and the safe answer is to end every session for that
-- account and make both of them sign in again. Losing a session is an
-- inconvenience; leaving the thief with a live one is not.
--
-- The index makes the "was this hash ever issued, even revoked" lookup cheap.
-- The existing partial index only covers live tokens, which is exactly the set
-- a replayed token is not in.
CREATE INDEX refresh_tokens_hash_idx ON refresh_tokens (token_hash);
