-- Middleman bridge schema additions.
--
-- Adds the columns and tables required for the chip-UID -> Stripe-Customer ->
-- off-session PaymentIntent flow. All changes are additive; legacy columns
-- (`implantId`, `nxtpayTokenId`, `expiresAt`, etc.) are retained so the older
-- simulator code paths continue to work during the transition.
--
-- This file is hand-written; it is NOT registered in `meta/_journal.json`.
-- Run `pnpm db:push` against a real database to have drizzle-kit regenerate
-- the migration plus matching snapshot, or apply this SQL manually.

ALTER TABLE `implants` ADD `uid` varchar(128);
ALTER TABLE `implants` ADD CONSTRAINT `implants_uid_unique` UNIQUE(`uid`);
ALTER TABLE `implants` ADD `label` varchar(128);

ALTER TABLE `transactions` ADD `stripePaymentIntentId` varchar(256);
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`);

CREATE TABLE `paymentMethods` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `stripePaymentMethodId` varchar(256) NOT NULL,
  `brand` varchar(32),
  `last4` varchar(4),
  `expMonth` int,
  `expYear` int,
  `isDefault` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `paymentMethods_id` PRIMARY KEY(`id`),
  CONSTRAINT `paymentMethods_stripePaymentMethodId_unique` UNIQUE(`stripePaymentMethodId`)
);

CREATE TABLE `merchants` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(256) NOT NULL,
  `stripeAccountId` varchar(256) NOT NULL,
  `apiKeyHash` varchar(128) NOT NULL,
  `apiKeyPrefix` varchar(32) NOT NULL,
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `merchants_id` PRIMARY KEY(`id`),
  CONSTRAINT `merchants_stripeAccountId_unique` UNIQUE(`stripeAccountId`),
  CONSTRAINT `merchants_apiKeyHash_unique` UNIQUE(`apiKeyHash`),
  CONSTRAINT `merchants_apiKeyPrefix_unique` UNIQUE(`apiKeyPrefix`)
);
