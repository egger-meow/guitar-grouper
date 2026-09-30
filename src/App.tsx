import React from 'react';

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-3">
          Guitar Group
        </h1>
        <p className="text-emerald-400 font-medium text-lg mb-4">
          吉他社分組神器
        </p>
        <p className="text-slate-400 text-sm">
          專為大專院校吉他社打造的即時分組與音樂品味配對系統。
        </p>
      </div>
    </main>
  );
}

export default App;
