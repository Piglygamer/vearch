import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentEmulator() {
  const [cardholderName, setCardholderName] = useState("Demo User");
  const [currentCardId, setCurrentCardId] = useState<string | null>(null);
  const [pin, setPin] = useState("1234");
  const [transAmount, setTransAmount] = useState("25.00");
  const [merchant, setMerchant] = useState("Starbucks");
  const [description, setDescription] = useState("Coffee");
  const [paymentMethodId, setPaymentMethodId] = useState("pm_test");
  const [initialBalance, setInitialBalance] = useState("1000");

  // tRPC mutations and queries
  const createCardMutation = trpc.paymentEmulator.createCard.useMutation();
  const getCardQuery = trpc.paymentEmulator.getCard.useQuery(
    { cardId: currentCardId || "" },
    { enabled: !!currentCardId }
  );
  const linkPaymentMutation = trpc.paymentEmulator.linkPaymentMethod.useMutation();
  const processTransactionMutation = trpc.paymentEmulator.processTransaction.useMutation();
  const emulateCardScanMutation = trpc.paymentEmulator.emulateCardScan.useMutation();
  const getTransactionsQuery = trpc.paymentEmulator.getTransactions.useQuery(
    { cardId: currentCardId || "" },
    { enabled: !!currentCardId }
  );
  const getMyCardsQuery = trpc.paymentEmulator.getMyCards.useQuery();

  const handleCreateCard = async () => {
    try {
      const result = await createCardMutation.mutateAsync({ cardholderName });
      setCurrentCardId(result.card.id);
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  const handleLinkPaymentMethod = async () => {
    if (!currentCardId) return;
    try {
      await linkPaymentMutation.mutateAsync({
        cardId: currentCardId,
        paymentMethodId,
        amount: parseFloat(initialBalance),
      });
      getCardQuery.refetch();
    } catch (error) {
      console.error("Error linking payment method:", error);
    }
  };

  const handleProcessTransaction = async () => {
    if (!currentCardId) return;
    try {
      await processTransactionMutation.mutateAsync({
        cardId: currentCardId,
        amount: parseFloat(transAmount),
        merchant,
        description,
      });
      getCardQuery.refetch();
      getTransactionsQuery.refetch();
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  };

  const handleEmulateCardScan = async () => {
    if (!currentCardId) return;
    try {
      await emulateCardScanMutation.mutateAsync({
        cardId: currentCardId,
        pin,
      });
    } catch (error) {
      console.error("Error emulating card scan:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 mb-2">
            🎯 Vearch Payment Emulator
          </h1>
          <p className="text-slate-400">
            World's First Payment Emulator - Stripe Cards That Never Expire
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Create Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">💳 Create Virtual Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-300">Cardholder Name</label>
                <Input
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="John Doe"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button
                onClick={handleCreateCard}
                disabled={createCardMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500"
              >
                {createCardMutation.isPending ? "Creating..." : "Generate Card (07/30979)"}
              </Button>
              {createCardMutation.data && (
                <Alert className="bg-green-900 border-green-700">
                  <AlertDescription className="text-green-200">
                    ✓ Card created! PAN: {createCardMutation.data.card.pan}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Active Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">🔐 Active Card</CardTitle>
            </CardHeader>
            <CardContent>
              {getCardQuery.data?.card ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PAN:</span>
                    <span className="font-mono text-cyan-400">{getCardQuery.data.card.pan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance:</span>
                    <span className="font-mono text-green-400">
                      ${getCardQuery.data.card.balance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expiry:</span>
                    <span className="font-mono text-cyan-400">{getCardQuery.data.card.expiry}</span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No card created yet</p>
              )}
            </CardContent>
          </Card>

          {/* Link Payment Method */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">💰 Link Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-300">Payment Method ID</label>
                <Input
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  placeholder="pm_1234567890"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Initial Balance ($)</label>
                <Input
                  type="number"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="1000"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button
                onClick={handleLinkPaymentMethod}
                disabled={linkPaymentMutation.isPending || !currentCardId}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500"
              >
                {linkPaymentMutation.isPending ? "Linking..." : "Link & Fund Card"}
              </Button>
            </CardContent>
          </Card>

          {/* Process Transaction */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">🛒 Process Transaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-300">Amount ($)</label>
                <Input
                  type="number"
                  value={transAmount}
                  onChange={(e) => setTransAmount(e.target.value)}
                  placeholder="25.00"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Merchant</label>
                <Input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Starbucks"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Coffee"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button
                onClick={handleProcessTransaction}
                disabled={processTransactionMutation.isPending || !currentCardId}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500"
              >
                {processTransactionMutation.isPending ? "Processing..." : "💳 Charge Card"}
              </Button>
            </CardContent>
          </Card>

          {/* Apex Flex Emulation */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">📱 Apex Flex Emulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-300">PIN (default: 1234)</label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button
                onClick={handleEmulateCardScan}
                disabled={emulateCardScanMutation.isPending || !currentCardId}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500"
              >
                {emulateCardScanMutation.isPending ? "Scanning..." : "📡 Scan Card"}
              </Button>
              {emulateCardScanMutation.data && (
                <Alert className="bg-blue-900 border-blue-700">
                  <AlertDescription className="text-blue-200 text-xs">
                    AID: {emulateCardScanMutation.data.appletData.aid}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* My Cards */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">📋 My Cards</CardTitle>
            </CardHeader>
            <CardContent>
              {getMyCardsQuery.data?.cards && getMyCardsQuery.data.cards.length > 0 ? (
                <div className="space-y-2">
                  {getMyCardsQuery.data.cards.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setCurrentCardId(card.id)}
                      className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-300">{card.cardholderName}</span>
                        <span className="text-cyan-400">****{card.pan.slice(-4)}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Balance: ${card.balance.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">No cards yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        {getTransactionsQuery.data?.transactions && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">📊 Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getTransactionsQuery.data.transactions.map((trans) => (
                  <div key={trans.id} className="p-3 bg-slate-700 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-300">{trans.merchant}</span>
                      <span className="text-green-400">-${trans.amount.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-slate-400">{trans.description}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(trans.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
