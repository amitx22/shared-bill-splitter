PRAGMA foreign_keys = ON;

CREATE TABLE homes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT homes_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
    id TEXT PRIMARY KEY NOT NULL,
    home_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT members_home_fk
        FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,

    CONSTRAINT members_position_positive
        CHECK (position >= 0),

    CONSTRAINT members_home_position_unique
        UNIQUE (home_id, position),

    CONSTRAINT members_name_not_empty
        CHECK (length(trim(name)) > 0)
);

CREATE TABLE bills (
    id TEXT PRIMARY KEY NOT NULL,
    home_id TEXT NOT NULL,
    title TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT bills_home_fk
        FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,

    CONSTRAINT bills_total_positive
        CHECK (total_cents > 0),

    CONSTRAINT bills_title_not_empty
        CHECK (length(trim(title)) > 0)
);

CREATE TABLE shares (
    id TEXT PRIMARY KEY NOT NULL,
    bill_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at TEXT,

    CONSTRAINT shares_bill_fk
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,

    CONSTRAINT shares_member_fk
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,

    CONSTRAINT shares_amount_non_negative
        CHECK (amount_cents >= 0),

    CONSTRAINT shares_bill_member_unique
        UNIQUE (bill_id, member_id)
);

CREATE TABLE idempotency_keys (
    idempotency_key TEXT PRIMARY KEY NOT NULL,
    share_id TEXT NOT NULL,
    paid_at TEXT NOT NULL,

    CONSTRAINT idempotency_share_fk
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
);

CREATE INDEX idx_members_home
ON members(home_id, position);

CREATE INDEX idx_bills_home
ON bills(home_id);

CREATE INDEX idx_shares_bill
ON shares(bill_id);

CREATE INDEX idx_shares_member
ON shares(member_id, paid_at);