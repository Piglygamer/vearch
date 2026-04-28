CREATE TABLE `stripeAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeAccountId` varchar(256) NOT NULL,
	`status` enum('pending','active','restricted','suspended') NOT NULL DEFAULT 'pending',
	`chargesEnabled` boolean DEFAULT false,
	`payoutsEnabled` boolean DEFAULT false,
	`onboardingUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeAccounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `stripeAccounts_stripeAccountId_unique` UNIQUE(`stripeAccountId`)
);
