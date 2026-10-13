-- Template tiers renamed (ADR-067): Free, Premium (any paid plan) and Signature (from the Premium plan).
-- PREMIUM first, so the old STANDARD can take its name. Rows keep their tier and templates.tier's default
-- (the middle tier) keeps its value under the new name: only the labels change.
ALTER TYPE "TemplateTier" RENAME VALUE 'PREMIUM' TO 'SIGNATURE';
ALTER TYPE "TemplateTier" RENAME VALUE 'STANDARD' TO 'PREMIUM';
