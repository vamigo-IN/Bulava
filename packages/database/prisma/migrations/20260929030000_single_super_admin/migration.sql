-- At most one Super Admin: a unique index over a constant, limited to SUPER_ADMIN rows.
-- (A separate migration: PostgreSQL cannot use an enum value in the transaction that adds it.)
CREATE UNIQUE INDEX "users_one_super_admin_key" ON "users" ((true)) WHERE "platformRole" = 'SUPER_ADMIN';
