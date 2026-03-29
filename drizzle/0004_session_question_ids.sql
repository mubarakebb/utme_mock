ALTER TABLE examSessions ADD COLUMN questionIds JSON NOT NULL DEFAULT '[]' COMMENT 'Ordered list of question IDs shown to user during this session';
