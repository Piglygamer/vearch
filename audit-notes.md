# Vearch Vault Audit Notes

## UI Issues Found
1. Dashboard looks basic/generic - dark background with teal/cyan accents, not premium
2. "Quick Deposit" card has no payment method selector - just a plain "Deposit Now" text link
3. "Quick Withdraw" card has a teal button but no method selector
4. Tab navigation (Overview, Implants, Cards, Wallets, Transactions) - need to check if tabs work
5. Stats cards (Active Implants: 0, Active Cards: 0, Total Balance: $1.00, Bank Status: ACTIVE) - look plain
6. No sidebar navigation - just a flat header
7. No user profile/avatar area
8. "Complete onboarding" status but no onboarding flow
9. The deposit/withdraw modals likely don't use the new payment methods (crypto/ACH/wire)
10. No visual hierarchy - everything looks the same weight

## Backend Issues to Check
- Legacy payment service files still exist (unifiedPaymentService.legacy.ts)
- Multiple overlapping services (paymentService, multiPaymentService, cryptoPaymentService, etc.)
- Monitoring spam in logs (every 30 seconds)
- High memory usage warnings (87.81%)
- Need to verify tRPC routers are properly wired

## Files to Review
- client/src/pages/Home.tsx (main dashboard)
- client/src/App.tsx (routing)
- server/routers.ts (tRPC procedures)
- drizzle/schema.ts (database schema)
