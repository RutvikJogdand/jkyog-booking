CREATE TABLE inventory (
  product_id text PRIMARY KEY,
  remaining integer NOT NULL CHECK (remaining >= 0)
);

CREATE TABLE bookings (
  id text PRIMARY KEY,
  receipt_token text NOT NULL UNIQUE,
  booker jsonb NOT NULL,
  selection jsonb NOT NULL,
  quote jsonb NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('simulated', 'free')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- booking_id is set in the same transaction that claims the key, so a committed
-- request always points at a complete booking.
CREATE TABLE booking_requests (
  idempotency_key text PRIMARY KEY,
  fingerprint text NOT NULL,
  booking_id text REFERENCES bookings (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
