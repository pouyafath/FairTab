CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_attachments_expense_id ON attachments(expense_id);
CREATE INDEX idx_attachments_group_id ON attachments(group_id);
