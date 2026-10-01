-- Runs once on first container start.
-- Extensions (citext) are created by Prisma migrations, not here, so that the
-- migration history fully describes the schema.
-- Separate database for the API integration/e2e test suite.
CREATE DATABASE bulava_test;
