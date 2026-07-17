CREATE TABLE IF NOT EXISTS forum_categories (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id UUID PRIMARY KEY,
  category_id VARCHAR(40) NOT NULL REFERENCES forum_categories(id),
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(140) NOT NULL CHECK (char_length(title) BETWEEN 5 AND 140),
  body VARCHAR(4000) NOT NULL CHECK (char_length(body) BETWEEN 10 AND 4000),
  status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'LOCKED', 'HIDDEN')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body VARCHAR(4000) NOT NULL CHECK (char_length(body) BETWEEN 2 AND 4000),
  status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'HIDDEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_topics_category_activity_idx
  ON forum_topics (category_id, last_activity_at DESC)
  WHERE status <> 'HIDDEN';

CREATE INDEX IF NOT EXISTS forum_topics_activity_idx
  ON forum_topics (is_pinned DESC, last_activity_at DESC)
  WHERE status <> 'HIDDEN';

CREATE INDEX IF NOT EXISTS forum_posts_topic_created_idx
  ON forum_posts (topic_id, created_at)
  WHERE status = 'PUBLISHED';

INSERT INTO forum_categories (id, name, description, position) VALUES
  ('lounge', 'Sugar Lounge', 'Introductions, conversation and community news.', 1),
  ('safety', 'Safety & Advice', 'Share practical advice for respectful and safer connections.', 2),
  ('travel', 'Travel & Lifestyle', 'Destinations, experiences and the finer details of life.', 3),
  ('crypto', 'Crypto & Wallet Help', 'Friendly help with wallets, USDC and platform payments.', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  position = EXCLUDED.position;
