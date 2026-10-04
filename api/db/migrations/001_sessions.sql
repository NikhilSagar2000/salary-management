-- Sign-in sessions. Only the SHA-256 of the cookie token is stored.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
