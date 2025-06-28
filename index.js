import React, { useState, useMemo } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Eye,
} from "lucide-react";
import Papa from "papaparse";

const ReconciliationTool = () => {
  const [internalFile, setInternalFile] = useState(null);
  const [providerFile, setProviderFile] = useState(null);
  const [internalData, setInternalData] = useState([]);
  const [providerData, setProviderData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reconciliationComplete, setReconciliationComplete] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("matched");
  const [error, setError] = useState("");

  // Parse CSV file
  const parseCSV = (file, setData, dataType) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) =>
          header.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn(
              `CSV parsing warnings for ${dataType}:`,
              results.errors
            );
          }

          // Validate required columns
          const requiredColumns = ["transaction_reference"];
          const headers = Object.keys(results.data[0] || {});
          const missingColumns = requiredColumns.filter(
            (col) => !headers.includes(col)
          );

          if (missingColumns.length > 0) {
            reject(
              `Missing required columns in ${dataType}: ${missingColumns.join(
                ", "
              )}`
            );
            return;
          }

          // Clean and standardize data
          const cleanedData = results.data
            .map((row) => ({
              transaction_reference: String(
                row.transaction_reference || ""
              ).trim(),
              amount: parseFloat(row.amount) || 0,
              status: String(row.status || "")
                .trim()
                .toLowerCase(),
              date: row.date || "",
              description: row.description || "",
              currency: row.currency || "",
              ...row,
            }))
            .filter((row) => row.transaction_reference); // Remove rows without reference

          setData(cleanedData);
          resolve(cleanedData);
        },
        error: (error) => reject(`Error parsing ${dataType}: ${error.message}`),
      });
    });
  };

  // Handle file upload
  const handleFileUpload = async (event, fileType) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload CSV files only");
      return;
    }

    setError("");

    try {
      if (fileType === "internal") {
        setInternalFile(file);
        await parseCSV(file, setInternalData, "Internal System Export");
      } else {
        setProviderFile(file);
        await parseCSV(file, setProviderData, "Provider Statement");
      }
    } catch (err) {
      setError(err);
    }
  };

  // Perform reconciliation
  const reconciliationResults = useMemo(() => {
    if (!internalData.length || !providerData.length) {
      return {
        matched: [],
        internalOnly: [],
        providerOnly: [],
        amountMismatches: [],
        statusMismatches: [],
      };
    }

    const matched = [];
    const internalOnly = [];
    const providerOnly = [];
    const amountMismatches = [];
    const statusMismatches = [];

    // Create maps for quick lookup
    const internalMap = new Map();
    const providerMap = new Map();

    internalData.forEach((transaction) => {
      internalMap.set(transaction.transaction_reference, transaction);
    });

    providerData.forEach((transaction) => {
      providerMap.set(transaction.transaction_reference, transaction);
    });

    // Check internal transactions
    internalData.forEach((internalTx) => {
      const providerTx = providerMap.get(internalTx.transaction_reference);

      if (providerTx) {
        const matchResult = {
          transaction_reference: internalTx.transaction_reference,
          internal: internalTx,
          provider: providerTx,
          amountMatch: Math.abs(internalTx.amount - providerTx.amount) < 0.01,
          statusMatch: internalTx.status === providerTx.status,
        };

        matched.push(matchResult);

        // Check for mismatches
        if (!matchResult.amountMatch) {
          amountMismatches.push(matchResult);
        }
        if (!matchResult.statusMatch) {
          statusMismatches.push(matchResult);
        }
      } else {
        internalOnly.push(internalTx);
      }
    });

    // Check provider transactions not in internal
    providerData.forEach((providerTx) => {
      if (!internalMap.has(providerTx.transaction_reference)) {
        providerOnly.push(providerTx);
      }
    });

    return {
      matched,
      internalOnly,
      providerOnly,
      amountMismatches,
      statusMismatches,
    };
  }, [internalData, providerData]);

  // Process reconciliation
  const processReconciliation = async () => {
    if (!internalData.length || !providerData.length) {
      setError("Please upload both CSV files before processing");
      return;
    }

    setIsProcessing(true);
    setError("");

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setReconciliationComplete(true);
    setIsProcessing(false);
  };

  // Export CSV function
  const exportCSV = (data, filename, type) => {
    let csvData = [];

    if (type === "matched") {
      csvData = data.map((item) => ({
        transaction_reference: item.transaction_reference,
        internal_amount: item.internal.amount,
        provider_amount: item.provider.amount,
        internal_status: item.internal.status,
        provider_status: item.provider.status,
        amount_match: item.amountMatch ? "Yes" : "No",
        status_match: item.statusMatch ? "Yes" : "No",
        internal_date: item.internal.date,
        provider_date: item.provider.date,
      }));
    } else {
      csvData = data;
    }

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format currency
  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const categories = [
    {
      id: "matched",
      label: "Matched Transactions",
      icon: CheckCircle,
      color: "green",
      data: reconciliationResults.matched,
    },
    {
      id: "internal",
      label: "Internal Only",
      icon: AlertTriangle,
      color: "yellow",
      data: reconciliationResults.internalOnly,
    },
    {
      id: "provider",
      label: "Provider Only",
      icon: XCircle,
      color: "red",
      data: reconciliationResults.providerOnly,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Payment Reconciliation Tool
              </h1>
              <p className="text-gray-600">
                Compare internal system transactions with payment processor
                statements
              </p>
            </div>
            <RefreshCw className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* File Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Internal File Upload */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-blue-600" />
              Internal System Export
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, "internal")}
                className="hidden"
                id="internal-upload"
              />
              <label htmlFor="internal-upload" className="cursor-pointer">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload Internal CSV File</p>
                <p className="text-sm text-gray-400">
                  Required columns: transaction_reference, amount, status
                </p>
              </label>
            </div>

            {internalFile && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ {internalFile.name} ({internalData.length} transactions)
                </p>
              </div>
            )}
          </div>

          {/* Provider File Upload */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-purple-600" />
              Provider Statement
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, "provider")}
                className="hidden"
                id="provider-upload"
              />
              <label htmlFor="provider-upload" className="cursor-pointer">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload Provider CSV File</p>
                <p className="text-sm text-gray-400">
                  Required columns: transaction_reference, amount, status
                </p>
              </label>
            </div>

            {providerFile && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ {providerFile.name} ({providerData.length} transactions)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Process Button */}
        {internalFile && providerFile && !reconciliationComplete && (
          <div className="text-center mb-6">
            <button
              onClick={processReconciliation}
              disabled={isProcessing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center mx-auto"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Processing Reconciliation...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Start Reconciliation
                </>
              )}
            </button>
          </div>
        )}

        {/* Results Section */}
        {reconciliationComplete && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {categories.map((category) => {
                const Icon = category.icon;
                const colorClasses = {
                  green: "bg-green-500 border-green-200 text-green-800",
                  yellow: "bg-yellow-500 border-yellow-200 text-yellow-800",
                  red: "bg-red-500 border-red-200 text-red-800",
                };

                return (
                  <div
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all hover:shadow-xl ${
                      selectedCategory === category.id
                        ? "ring-2 ring-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Icon
                        className={`w-8 h-8 ${colorClasses[
                          category.color
                        ].replace("bg-", "text-")}`}
                      />
                      <span className="text-2xl font-bold text-gray-900">
                        {category.data.length}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {category.label}
                    </h3>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-gray-600">
                        Click to view details
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCSV(
                            category.data,
                            `${category.id}_transactions.csv`,
                            category.id
                          );
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mismatch Alerts */}
            {(reconciliationResults.amountMismatches.length > 0 ||
              reconciliationResults.statusMismatches.length > 0) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-orange-800 mb-2">
                  ⚠️ Data Mismatches Detected
                </h3>
                {reconciliationResults.amountMismatches.length > 0 && (
                  <p className="text-sm text-orange-700">
                    • {reconciliationResults.amountMismatches.length}{" "}
                    transactions with amount mismatches
                  </p>
                )}
                {reconciliationResults.statusMismatches.length > 0 && (
                  <p className="text-sm text-orange-700">
                    • {reconciliationResults.statusMismatches.length}{" "}
                    transactions with status mismatches
                  </p>
                )}
              </div>
            )}

            {/* Detailed View */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {categories.find((cat) => cat.id === selectedCategory)?.label}
                  (
                  {
                    categories.find((cat) => cat.id === selectedCategory)?.data
                      .length
                  }
                  )
                </h2>
                <button
                  onClick={() => {
                    const selectedData = categories.find(
                      (cat) => cat.id === selectedCategory
                    )?.data;
                    exportCSV(
                      selectedData,
                      `${selectedCategory}_detailed.csv`,
                      selectedCategory
                    );
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                {selectedCategory === "matched" ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Reference
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Internal Amount
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Provider Amount
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Internal Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Provider Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Flags
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationResults.matched.map((match) => (
                        <tr
                          key={match.transaction_reference}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 font-mono text-sm">
                            {match.transaction_reference}
                          </td>
                          <td
                            className={`py-3 px-4 ${
                              !match.amountMatch ? "bg-red-50 text-red-700" : ""
                            }`}
                          >
                            {formatCurrency(
                              match.internal.amount,
                              match.internal.currency
                            )}
                          </td>
                          <td
                            className={`py-3 px-4 ${
                              !match.amountMatch ? "bg-red-50 text-red-700" : ""
                            }`}
                          >
                            {formatCurrency(
                              match.provider.amount,
                              match.provider.currency
                            )}
                          </td>
                          <td
                            className={`py-3 px-4 ${
                              !match.statusMatch
                                ? "bg-yellow-50 text-yellow-700"
                                : ""
                            }`}
                          >
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {match.internal.status}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 ${
                              !match.statusMatch
                                ? "bg-yellow-50 text-yellow-700"
                                : ""
                            }`}
                          >
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {match.provider.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-1">
                              {!match.amountMatch && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                  Amount
                                </span>
                              )}
                              {!match.statusMatch && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                  Status
                                </span>
                              )}
                              {match.amountMatch && match.statusMatch && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                  Perfect
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Reference
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Amount
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedCategory === "internal"
                        ? reconciliationResults.internalOnly
                        : reconciliationResults.providerOnly
                      ).map((transaction) => (
                        <tr
                          key={transaction.transaction_reference}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 font-mono text-sm">
                            {transaction.transaction_reference}
                          </td>
                          <td className="py-3 px-4">
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {transaction.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {transaction.date}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {transaction.description || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {categories.find((cat) => cat.id === selectedCategory)?.data
                  .length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No transactions in this category
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReconciliationTool;
