"use client";

import React from "react";
import useSWR from "swr";
import { Loader2, RefreshCcw, Search } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ApiDashboard() {
  const { data, error, isLoading, mutate } = useSWR("/api/getApis", fetcher);
  const [query, setQuery] = React.useState("");

  if (error)
    return (
      <div className="p-8 text-red-600 dark:text-red-400 text-center">
        ❌ Failed to load API dashboard
      </div>
    );

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3 text-gray-600 dark:text-gray-300">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 w-8 h-8" />
        <p>Loading routes…</p>
      </div>
    );

  const filtered = data.routes.filter((r: any) =>
    r.route.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      <main className="flex flex-col items-center px-6 sm:px-20 py-12 gap-6 w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-2">
            🧭 API Dashboard
          </h1>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search routes..."
            className="w-full pl-10 pr-3 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 w-full mt-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Routes</p>
            <p className="text-3xl font-semibold text-blue-600 dark:text-blue-400">
              {data.count}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Filtered</p>
            <p className="text-3xl font-semibold text-green-600 dark:text-green-400">
              {filtered.length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
          <table className="min-w-full text-left">
            <thead className="bg-blue-100 dark:bg-gray-700 text-blue-900 dark:text-gray-200 text-sm font-semibold uppercase">
              <tr>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">Route</th>
                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">File Path</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr
                  key={r.route}
                  className="hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                  <td className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 font-medium">
                    {r.route}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 font-mono text-sm text-gray-600 dark:text-gray-400">
                    {r.file}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No routes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-8 text-center">
          Auto-scanned from <code>@/app/api</code>
        </p>
      </main>
    </div>
  );
}
