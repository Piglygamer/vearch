# Vearch Bank - Core Functionality Fixes

## Phase 1: Fix Wallet Creation & Deposits/Withdrawals

- [ ] Debug why wallet creation is failing on login
- [ ] Ensure wallet is created for every user on first login
- [ ] Test deposit flow: user → amount → payment provider → wallet balance increases
- [ ] Test withdrawal flow: user → amount → wallet balance decreases
- [ ] Verify all money stays in database (not sent to external services)
- [ ] Test balance retrieval and display on dashboard

## Phase 2: Verify Local Money Management

- [ ] Confirm all transactions are stored in database
- [ ] Verify no external API calls for payment processing (mock mode)
- [ ] Test transaction history shows all deposits/withdrawals
- [ ] Verify wallet balance is accurate after multiple transactions
- [ ] Test multi-user isolation (user A's balance doesn't affect user B)

## Phase 3: Complete User Flow Testing

- [ ] User signup → wallet auto-created
- [ ] User deposits $100 → balance shows $100
- [ ] User links implant via NFC → implant ID stored
- [ ] Applet deployed to implant → applet has payment card
- [ ] Implant can make transactions → balance decreases
- [ ] User withdraws $50 → balance shows $50

## Phase 4: Production Deployment

- [ ] All tests passing (118+)
- [ ] No errors in console or logs
- [ ] System deployed and accessible
- [ ] Ready for real users

