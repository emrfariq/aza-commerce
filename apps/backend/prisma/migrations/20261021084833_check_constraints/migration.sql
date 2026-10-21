-- Domain CHECK constraints that Prisma schema cannot express.
-- The migration is additive; applying it against the already-created tables.
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0),
  ADD CONSTRAINT "products_stock_non_negative" CHECK ("stock" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_unit_price_positive" CHECK ("unit_price" > 0),
  ADD CONSTRAINT "order_items_subtotal_non_negative" CHECK ("subtotal" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_amount_non_negative" CHECK ("total_amount" >= 0);
