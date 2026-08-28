-- How somebody takes nicotine, when that is what they are quitting.
--
-- Cleat models nicotine as one substance, which is right: the dependence is
-- the same, the craving waves are the same, and the withdrawal is the same.
-- What is not the same is the body.
--
-- The milestone timeline for stopping smoking is about lungs, carbon monoxide
-- and cardiovascular risk, taken from NHS Better Health and the CDC. None of
-- it applies to somebody who has never smoked and is quitting snus, and this
-- is Sweden — a large share of the people this product is for have never lit
-- anything. Telling them their lung function has improved is not encouragement
-- that misses; it is a false claim about their body, from a product whose
-- entire argument is that it does not do that.
--
-- Nullable, because every plan created before this column existed was made by
-- somebody who was never asked. Null means unknown, and unknown gets only the
-- milestones that hold for nicotine regardless of how it was taken.

ALTER TABLE quits
  ADD COLUMN intake_form text
    CHECK (intake_form IN ('smoked', 'oral', 'both'));

COMMENT ON COLUMN quits.intake_form IS
  'Nicotine only. Null means the person was never asked; they get the '
  'intake-neutral milestones rather than claims about lungs they may not have '
  'harmed.';
