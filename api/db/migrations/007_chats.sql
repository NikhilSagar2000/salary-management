-- Saved assistant chats (D8, D9). Deleting a chat deletes its messages.
CREATE TABLE chats (
  id serial PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX chats_recent ON chats (updated_at DESC, id DESC);

CREATE TABLE chat_messages (
  id serial PRIMARY KEY,
  chat_id int NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb,
  based_on_data boolean,
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'stopped', 'error')),
  error_kind text CHECK (error_kind IN ('rate_limited', 'unavailable')),
  created_at timestamptz NOT NULL
);
CREATE INDEX chat_messages_chat ON chat_messages (chat_id, id);
