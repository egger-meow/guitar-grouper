import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode } from 'lucide-react';

export interface QRCodeDisplayProps {
  roomCode: string;
  baseUrl?: string;
  size?: number;
}

export function QRCodeDisplay({
  roomCode,
  baseUrl = 'https://guitar-grouper.jjmowlab.com',
  size = 200,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const code = roomCode.toUpperCase();
  const joinUrl = `${baseUrl}/?room=${code}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(joinUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-4 text-amber-400 font-bold tracking-wide text-sm">
        <QrCode className="w-5 h-5" />
        <span>掃描立即加入房間</span>
      </div>

      <div className="p-4 bg-white rounded-2xl shadow-inner mb-4 flex items-center justify-center">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#0f172a"
        />
      </div>

      <p className="text-slate-400 text-xs break-all mb-4 px-2 select-all font-mono">
        {joinUrl}
      </p>

      <button
        type="button"
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>已複製連結！</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>複製連結</span>
          </>
        )}
      </button>
    </div>
  );
}
