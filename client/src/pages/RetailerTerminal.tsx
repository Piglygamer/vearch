/**
 * Retailer Terminal Interface
 * Allows cashiers at Walgreens, 7-Eleven, Family Dollar, etc. to process cash withdrawals
 * Scan QR code or enter code manually to verify and dispense cash
 */

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalCode {
  code: string;
  amount: number;
  status: "active" | "claimed" | "expired" | "invalid";
  expiresAt: string;
  message: string;
}

export default function RetailerTerminal() {
  const [location, setLocation] = useState("Walgreens");
  const [code, setCode] = useState("");
  const [withdrawalData, setWithdrawalData] = useState<WithdrawalCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanningActive, setScanningActive] = useState(false);

  const retailers = [
    "Walgreens",
    "CVS",
    "7-Eleven",
    "Family Dollar",
    "Dollar General",
    "Walmart",
    "Target",
    "Best Buy",
  ];

  /**
   * Verify withdrawal code
   */
  const verifyCode = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) {
      setError("Please enter or scan a code");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);
    setWithdrawalData(null);

    try {
      const response = await fetch(`/api/cash-withdrawal/status/${codeToVerify}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid code");
        setWithdrawalData({
          code: codeToVerify,
          amount: 0,
          status: "invalid",
          expiresAt: "",
          message: data.error || "Code not found",
        });
        return;
      }

      setWithdrawalData({
        code: data.code,
        amount: data.amount,
        status: data.status,
        expiresAt: data.expiresAt,
        message: `Valid code - Customer can withdraw $${data.amount}`,
      });
    } catch (err) {
      setError("Failed to verify code");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Process withdrawal (mark as claimed)
   */
  const processWithdrawal = async () => {
    if (!withdrawalData || withdrawalData.status !== "active") {
      setError("Cannot process this withdrawal");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/cash-withdrawal/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: withdrawalData.code,
          location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process withdrawal");
        return;
      }

      setSuccess(true);
      setWithdrawalData({
        ...withdrawalData,
        status: "claimed",
        message: `✓ Withdrawal processed! Dispense $${withdrawalData.amount} to customer`,
      });

      // Reset form after 3 seconds
      setTimeout(() => {
        setCode("");
        setWithdrawalData(null);
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError("Failed to process withdrawal");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start QR code scanner
   */
  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanningActive(true);
      }
    } catch (err) {
      setError("Camera access denied. Please enter code manually.");
      console.error(err);
    }
  };

  /**
   * Stop QR code scanner
   */
  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setScanningActive(false);
    }
  };

  /**
   * Handle manual code entry
   */
  const handleCodeEntry = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      verifyCode(code);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Vearch Bank Terminal</h1>
          <p className="text-slate-400">Cash Withdrawal Processing</p>
        </div>

        {/* Location Selection */}
        <Card className="bg-slate-800 border-slate-700 mb-6 p-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Retail Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none"
          >
            {retailers.map((retailer) => (
              <option key={retailer} value={retailer}>
                {retailer}
              </option>
            ))}
          </select>
        </Card>

        {/* QR Scanner or Manual Entry */}
        <Card className="bg-slate-800 border-slate-700 mb-6 p-6">
          <div className="space-y-4">
            {/* Scanner Toggle */}
            <div className="flex gap-2">
              {!scanningActive ? (
                <Button
                  onClick={startScanning}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                >
                  📷 Start QR Scanner
                </Button>
              ) : (
                <Button
                  onClick={stopScanning}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  ✕ Stop Scanner
                </Button>
              )}
            </div>

            {/* Video Stream */}
            {scanningActive && (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 border-2 border-cyan-500 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-500 rounded-lg"></div>
                </div>
              </div>
            )}

            {/* Manual Code Entry */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Or Enter Code Manually
              </label>
              <Input
                type="text"
                placeholder="Enter withdrawal code (e.g., A1B2C3D4)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleCodeEntry}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
              />
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => verifyCode(code)}
              disabled={loading || !code.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </Button>
          </div>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert className="bg-red-900/50 border-red-700 mb-6">
            <AlertDescription className="text-red-200">⚠️ {error}</AlertDescription>
          </Alert>
        )}

        {/* Withdrawal Details */}
        {withdrawalData && (
          <Card
            className={`mb-6 p-6 border-2 ${
              withdrawalData.status === "active"
                ? "bg-green-900/30 border-green-600"
                : withdrawalData.status === "claimed"
                  ? "bg-blue-900/30 border-blue-600"
                  : "bg-red-900/30 border-red-600"
            }`}
          >
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Withdrawal Code</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {withdrawalData.code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Amount</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${withdrawalData.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Status</p>
                  <p
                    className={`text-lg font-bold ${
                      withdrawalData.status === "active"
                        ? "text-green-400"
                        : withdrawalData.status === "claimed"
                          ? "text-blue-400"
                          : "text-red-400"
                    }`}
                  >
                    {withdrawalData.status.toUpperCase()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Expires</p>
                <p className="text-white">
                  {new Date(withdrawalData.expiresAt).toLocaleString()}
                </p>
              </div>

              <Alert
                className={`${
                  success
                    ? "bg-green-900/50 border-green-700"
                    : "bg-blue-900/50 border-blue-700"
                }`}
              >
                <AlertDescription
                  className={success ? "text-green-200" : "text-blue-200"}
                >
                  {withdrawalData.message}
                </AlertDescription>
              </Alert>

              {/* Process Button */}
              {withdrawalData.status === "active" && !success && (
                <Button
                  onClick={processWithdrawal}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg"
                >
                  {loading ? "Processing..." : "✓ Confirm & Dispense Cash"}
                </Button>
              )}

              {success && (
                <div className="text-center py-4">
                  <p className="text-2xl">✓ Transaction Complete</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Resetting in 3 seconds...
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Instructions</h3>
          <ol className="space-y-2 text-slate-300">
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">1.</span>
              <span>Select the retail location from the dropdown</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">2.</span>
              <span>Ask customer to show their Vearch Bank withdrawal code</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">3.</span>
              <span>Scan the QR code or manually enter the code</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">4.</span>
              <span>Verify the amount and customer information</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">5.</span>
              <span>Click "Confirm & Dispense Cash" to complete</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">6.</span>
              <span>Dispense the exact amount shown to the customer</span>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
