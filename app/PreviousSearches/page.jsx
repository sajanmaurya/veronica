'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function PreviousSearchesPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  const fetchSearches = async () => {
    try {
      const res = await fetch('/api/previousSearches/products');
      const data = await res.json();

      setSearches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching previous searches:', error);
      setSearches([]);
    } finally {
      setLoading(false);
    }
  };

  fetchSearches();
}, []);

  if (loading) {
    return <div className="text-center mt-10 text-gray-600">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">Your Previous Product Searches</h1>

      {searches.length === 0 ? (
        <p className="text-center text-gray-500">No previous searches found.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {searches.map((search) => (
            <div
              key={search.id}
              className="bg-white border rounded-xl shadow hover:shadow-lg transition duration-300 p-4 flex flex-col"
            >
              {search.imageFrontUrl && (
                <Image
                  src={search.imageFrontUrl}
                  alt={search.productName || 'Product Image'}
                  width={300}
                  height={300}
                  className="rounded object-contain mx-auto"
                />
              )}

              <div className="mt-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {search.productName || 'Unnamed Product'}
                </h2>
                <p className="text-sm text-gray-500 mb-1">
                  <span className="font-medium">Rating:</span> {search.aiData?.rating}/10
                </p>
                <p className="text-sm text-gray-400">
                  <span className="font-medium">Date:</span>{' '}
                  {new Date(search.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
