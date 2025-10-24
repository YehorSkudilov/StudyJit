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
      <div className="p-8 text-red-600">
        ❌ Failed to load API dashboard
      </div>
    );

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="animate-spin text-gray-500 w-8 h-8" />
        <p className="text-gray-500">Loading routes…</p>
      </div>
    );

  const filtered = data.routes.filter((r: any) =>
    r.route.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            🧭 API Dashboard
          </h1>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-100"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search routes..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-white shadow-sm rounded-xl p-4 border flex-1 text-center">
            <p className="text-gray-500 text-sm">Total Routes</p>
            <p className="text-2xl font-semibold text-blue-600">
              {data.count}
            </p>
          </div>
          <div className="bg-white shadow-sm rounded-xl p-4 border flex-1 text-center">
            <p className="text-gray-500 text-sm">Filtered Routes</p>
            <p className="text-2xl font-semibold text-green-600">
              {filtered.length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-xl border overflow-hidden">
          <table className="min-w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 uppercase text-sm font-semibold">
              <tr>
                <th className="px-4 py-3 border-b">Route</th>
                <th className="px-4 py-3 border-b">File Path</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr
                  key={r.route}
                  className="hover:bg-blue-50 transition-colors duration-100"
                >
                  <td className="px-4 py-2 border-b font-medium text-gray-800">
                    {r.route}
                  </td>
                  <td className="px-4 py-2 border-b text-gray-500 font-mono text-sm">
                    {r.file}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No routes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Auto-scanned from <code>@/app/api</code>
        </p>
      </div>
    </main>
  );
}
