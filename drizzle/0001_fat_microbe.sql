CREATE TABLE `cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`implantId` int,
	`cardNumber` varchar(256) NOT NULL,
	`cardToken` varchar(512) NOT NULL,
	`expiryMonth` int NOT NULL,
	`expiryYear` int NOT NULL,
	`cvv` varchar(256),
	`cardholderName` varchar(256),
	`status` enum('active','suspended','expired','revoked') NOT NULL DEFAULT 'active',
	`fundingSourceId` int,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `implants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`implantId` varchar(128) NOT NULL,
	`implantType` varchar(64) NOT NULL,
	`nxtpayTokenId` varchar(256),
	`status` enum('active','expiring','expired','revoked') NOT NULL DEFAULT 'active',
	`linkedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `implants_id` PRIMARY KEY(`id`),
	CONSTRAINT `implants_implantId_unique` UNIQUE(`implantId`)
);
--> statement-breakpoint
CREATE TABLE `systemHealth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkType` enum('vulnerability_scan','code_integrity','database_health','api_health') NOT NULL,
	`status` enum('healthy','warning','critical') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`description` text,
	`autoRepaired` boolean DEFAULT false,
	`repairDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `systemHealth_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tokenReprovisioningLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`implantId` int NOT NULL,
	`oldTokenId` int,
	`newTokenId` int,
	`reason` enum('expiration_approaching','scheduled_renewal','manual_request','security_patch') NOT NULL,
	`status` enum('initiated','in_progress','completed','failed') NOT NULL DEFAULT 'initiated',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `tokenReprovisioningLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`implantId` int NOT NULL,
	`tokenType` enum('nxtpay','vearch') NOT NULL,
	`tokenValue` varchar(512) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('active','expiring','expired','revoked') NOT NULL DEFAULT 'active',
	`reprovisioningScheduledAt` timestamp,
	`reprovisionedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` int,
	`implantId` int,
	`walletId` int,
	`transactionType` enum('payment','refund','topup','transfer') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','completed','failed','reversed') NOT NULL DEFAULT 'pending',
	`merchantName` varchar(256),
	`description` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletType` enum('bank_account','prepaid','crypto','other') NOT NULL,
	`fundingSourceId` varchar(256) NOT NULL,
	`balance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('active','pending','suspended','disconnected') NOT NULL DEFAULT 'active',
	`linkedAt` timestamp NOT NULL DEFAULT (now()),
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`)
);
