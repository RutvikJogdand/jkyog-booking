-- Starting stock from the assignment (PRD section 3). Inserts missing rows only,
-- so re-running never resets stock that bookings have already used.
INSERT INTO inventory (product_id, remaining) VALUES
  ('day_adult', 380),
  ('day_child', 260),
  ('all_days_adult', 0),
  ('all_days_child', 140),
  ('family', 95),
  ('dandiya_sticks', 900),
  ('dinner_plate', 1700),
  ('garba_workshop', 2)
ON CONFLICT (product_id) DO NOTHING;
