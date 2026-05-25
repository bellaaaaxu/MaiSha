-- 006_expense_tracking.sql
-- Add optional expense amount to purchase history

ALTER TABLE purchase_history ADD COLUMN amount NUMERIC(10,2);
ALTER TABLE purchase_history ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY';
