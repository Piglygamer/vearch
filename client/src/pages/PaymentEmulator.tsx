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
        description: "Transaction",
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
              <Input
                placeholder="Cardholder Name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={handleCreateCard}
                disabled={createCardMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {createCardMutation.isPending ? "Creating..." : "Create Card"}
              </Button>
              {getCardQuery.data?.card && (
                <Alert className="bg-slate-700 border-slate-600">
                  <AlertDescription className="text-cyan-400">
                    <div className="space-y-2">
                      <div>
                        <strong>Card ID:</strong> {getCardQuery.data.card.id}
                      </div>
                      <div>
                        <strong>PAN:</strong> ****{getCardQuery.data.card.pan.slice(-4)}
                      </div>
                      <div>
                        <strong>Expiry:</strong> {getCardQuery.data.card.expiry}
                      </div>
                      <div>
                        <strong>Balance:</strong> ${getCardQuery.data.card.balance.toFixed(2)}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Link Payment Method */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">💰 Link Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Payment Method ID"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="Initial Balance"
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={handleLinkPaymentMethod}
                disabled={!currentCardId || linkPaymentMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {linkPaymentMutation.isPending ? "Linking..." : "Link Payment Method"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Process Transaction */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">🛒 Process Transaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Amount"
                type="number"
                value={transAmount}
                onChange={(e) => setTransAmount(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="Merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={handleProcessTransaction}
                disabled={!currentCardId || processTransactionMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {processTransactionMutation.isPending ? "Processing..." : "Process Transaction"}
              </Button>
            </CardContent>
          </Card>

          {/* Emulate Card Scan */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">📱 Emulate Card Scan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="PIN"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={handleEmulateCardScan}
                disabled={!currentCardId || emulateCardScanMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {emulateCardScanMutation.isPending ? "Scanning..." : "Emulate Scan"}
              </Button>
              {emulateCardScanMutation.data && (
                <Alert className="bg-slate-700 border-slate-600">
                  <AlertDescription className="text-cyan-400">
                    <div className="space-y-2">
                      <div>
                        <strong>AID:</strong> {emulateCardScanMutation.data.appletData.aid}
                      </div>
                      <div>
                        <strong>PAN:</strong> {emulateCardScanMutation.data.appletData.pan}
                      </div>
                      <div>
                        <strong>Balance:</strong> ${emulateCardScanMutation.data.appletData.balance.toFixed(2)}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        {getTransactionsQuery.data?.transactions && getTransactionsQuery.data.transactions.length > 0 && (
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
                    <div className="text-xs text-slate-500">
                      {new Date(trans.date).toLocaleString()}
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
