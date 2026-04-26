"use client";

import { useEffect, useState } from "react";
import { useRealtime } from "@/components/RealtimeProvider";
import { buildApiUrl } from "@/lib/api";

const NOTIFICATION_REFRESH_EVENT = "notifications:refresh";

type TransactionStatus = "pending" | "paid" | "overdue";

type Transaction = {
  id: number;
  company_id: number;
  amount: number;
  status: TransactionStatus;
  due_date: string;
  description: string;
  created_at: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusStyles(status: TransactionStatus) {
  if (status === "paid") {
    return "bg-emerald-400/15 text-emerald-200 border border-emerald-400/20";
  }

  if (status === "overdue") {
    return "bg-rose-400/15 text-rose-200 border border-rose-400/20";
  }

  return "bg-amber-400/15 text-amber-100 border border-amber-400/20";
}

export default function TransactionsPage() {
  const { isPollingFallback, latestTransactionUpdate, pollTick } = useRealtime();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingTransactionId, setPayingTransactionId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTransactions() {
      setLoading(true);

      try {
        const response = await fetch(buildApiUrl("/transactions"));

        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }

        const data: Transaction[] = await response.json();

        if (isMounted) {
          setTransactions(data);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load transactions",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadTransactions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!latestTransactionUpdate) {
      return;
    }

    setTransactions((currentTransactions) => {
      const nextTransaction = latestTransactionUpdate.transaction;
      const existingTransaction = currentTransactions.find(
        (transaction) => transaction.id === nextTransaction.id,
      );

      if (!existingTransaction) {
        return [nextTransaction, ...currentTransactions];
      }

      return currentTransactions.map((transaction) =>
        transaction.id === nextTransaction.id ? nextTransaction : transaction,
      );
    });
  }, [latestTransactionUpdate]);

  useEffect(() => {
    if (!isPollingFallback || pollTick === 0) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(buildApiUrl("/transactions"));

        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }

        const data: Transaction[] = await response.json();
        setTransactions(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load transactions",
        );
      }
    })();
  }, [isPollingFallback, pollTick]);

  async function payTransaction(transactionId: number) {
    setPayingTransactionId(transactionId);

    try {
      const response = await fetch(
        buildApiUrl(`/transactions/${transactionId}/pay`),
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to pay transaction");
      }

      const updatedTransaction: Transaction = await response.json();

      setTransactions((currentTransactions) =>
        currentTransactions.map((transaction) =>
          transaction.id === transactionId ? updatedTransaction : transaction,
        ),
      );
      setError(null);

      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_REFRESH_EVENT, {
          detail: { dismissOverdue: true },
        }),
      );
    } catch (payError) {
      setError(
        payError instanceof Error
          ? payError.message
          : "Failed to pay transaction",
      );
    } finally {
      setPayingTransactionId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold">Transactions</h1>
          <p className="mt-2 text-slate-400">
            Review payment status and settle outstanding invoices.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-xl backdrop-blur">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-lg font-semibold text-white">
              Payment Activity
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-sm text-slate-400">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-12 text-sm text-slate-400">
              No transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const isPaying = payingTransactionId === transaction.id;
                    const isPaid = transaction.status === "paid";

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b border-white/5 transition hover:bg-white/5"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {formatDate(transaction.due_date)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusStyles(
                              transaction.status,
                            )}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => payTransaction(transaction.id)}
                            disabled={isPaid || isPaying}
                            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                          >
                            {isPaid
                              ? "Paid"
                              : isPaying
                                ? "Paying..."
                                : "Pay Now"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
