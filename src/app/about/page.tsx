import React from 'react';

export default function AboutPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-2xl py-10 text-white">
        <h1 className="text-3xl font-bold mb-4">About Us</h1>
        <p className="text-lg leading-relaxed">
          Welcome to our app! We help users track their expenses, manage categories,
          and visualize financial insights clearly and simply.
        </p>
      </div>
    </div>
  );
}
