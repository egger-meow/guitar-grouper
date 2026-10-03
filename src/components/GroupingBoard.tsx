import { useState, useRef } from 'react';
import type { HostSettings, OptimizationResult, Participant } from '../types/domain';
import { getTagNameZh } from '../engine/taxonomy';

interface Props {
  result: OptimizationResult;
  participants: Record<string, Participant>;
  settings: HostSettings;
  draftRevision: number;
  publishedRevision: number;
  publishedResult: OptimizationResult | null;
  canUndo: boolean;
  onAction: (action: 'move' | 'fill' | 'undo' | 'publish', payload?: Record<string, unknown>) => Promise<void>;
  onRerun?: () => void;
  optimizing?: boolean;
}

export function GroupingBoard({ result, participants, settings, draftRevision, publishedRevision, publishedResult, canUndo, onAction, onRerun, optimizing = false }: Props) {
  const [saving, setBusy] = useState(false);
  const inFlight = useRef(false);
  const pointerDrag = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const busy = saving || optimizing;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const assigned = new Set(result.groups.flatMap(g => g.memberIds));
  const pending = Object.values(participants).filter(p => !assigned.has(p.id));
  const dirty = draftRevision !== publishedRevision;
  const changed = Object.values(participants).filter(p => {
    const before = publishedResult?.groups.find(g => g.memberIds.includes(p.id))?.id;
    const after = result.groups.find(g => g.memberIds.includes(p.id))?.id;
    return before !== after;
  }).length;

  async function act(action: 'move' | 'fill' | 'undo' | 'publish', payload?: Record<string, unknown>) {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await onAction(action, payload);
      setConfirmPublish(false);
      if (action === 'fill') setNotice('補位完成；若仍有人未分組，代表目前各組沒有空位。可手動調整、提高人數上限，或全部重新分組。');
      if (action === 'publish') setNotice('結果已發布給成員。');
    } catch (e) { setError(e instanceof Error ? e.message : '操作失敗，請重試'); }
    finally { inFlight.current = false; setBusy(false); setDragged(null); setHover(null); }
  }

  function member(p: Participant, groupId: string | null) {
    return <div key={p.id} draggable={!busy} onDragStart={e => {
      if (pointerDrag.current) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDragged(p.id);
    }}
      onPointerDown={e => {
        if (busy || e.button !== 0 || (e.target as HTMLElement).closest('select,button')) return;
        // Touch scrolling stays available; the grip explicitly starts a touch drag.
        if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('[data-drag-grip]')) return;
        e.preventDefault();
        pointerDrag.current = { id: p.id, x: e.clientX, y: e.clientY, active: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const drag = pointerDrag.current;
        if (!drag || drag.id !== p.id) return;
        if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.active = true;
        setDragged(p.id);
        const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop-zone]');
        setHover(zone?.getAttribute('data-drop-zone') ?? null);
        if (e.clientY < 90) window.scrollBy(0, -24);
        else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 24);
      }}
      onPointerUp={e => {
        const drag = pointerDrag.current;
        pointerDrag.current = null;
        setDragged(null); setHover(null);
        if (!drag?.active) return;
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop-zone]')?.getAttribute('data-drop-zone');
        if (target) void act('move', { participantId: drag.id, groupId: target === 'pending' ? null : target });
      }}
      onPointerCancel={() => { pointerDrag.current = null; setDragged(null); setHover(null); }}
      onDragEnd={() => { setDragged(null); setHover(null); }}
      className={`select-none rounded-xl border border-slate-600 bg-slate-800 p-3 space-y-2 ${busy ? 'opacity-70' : 'cursor-grab active:cursor-grabbing'} ${dragged === p.id ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2"><span data-drag-grip aria-hidden="true" className="touch-none text-slate-500">⠿</span><strong className="text-white">{p.name}</strong></div>
      <p className="text-xs text-indigo-300">{p.capabilities.map(getTagNameZh).join('、')}</p>
      <select aria-label={`移動 ${p.name}`} value={groupId ?? ''} disabled={busy}
        onChange={e => void act('move', { participantId: p.id, groupId: e.target.value || null })}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-slate-200 cursor-pointer">
        <option value="">未分組</option>
        {result.groups.map(g => <option key={g.id} value={g.id} disabled={g.id !== groupId && g.members.length >= (settings.maxGroupSize ?? 8)}>{g.name}（{g.members.length} 人）</option>)}
      </select>
    </div>;
  }

  function dropZone(groupId: string | null) {
    const key = groupId ?? 'pending';
    const group = result.groups.find(g => g.id === groupId);
    const full = group && group.members.length >= (settings.maxGroupSize ?? 8) && !group.memberIds.includes(dragged ?? '');
    return {
      'data-drop-zone': key,
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = busy || full ? 'none' : 'move'; setHover(key); },
      onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(null); },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); setHover(null); const id = e.dataTransfer.getData('text/plain'); if (participants[id]) void act('move', { participantId: id, groupId }); },
      className: `rounded-2xl border-2 p-4 space-y-3 transition-colors ${hover === key ? full ? 'border-red-400 bg-red-950/20' : 'border-indigo-400 bg-indigo-950/40' : 'border-slate-700 bg-slate-900/70'}`,
    };
  }

  return <section aria-label="分組草稿看板" className="rounded-3xl border border-indigo-500/40 bg-slate-900 p-4 sm:p-6 space-y-5">
    <div className="space-y-2">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${dirty ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
        {!publishedResult ? '尚未發布' : dirty ? '有未發布的修改' : '已發布'}</span>
      <h3 className="text-2xl font-bold text-white">分組草稿看板</h3>
      <p className="text-sm text-slate-300">{!publishedResult ? '目前只有房主看得到，成員正在等待發布。' : dirty ? '你正在調整草稿，成員仍看到上次發布的結果。' : '成員目前看到這個版本。調整後請再次發布。'}</p>
      <p className="text-xs text-slate-400">拖曳成員到另一組或未分組區；手機可使用成員卡片的選單。一般移動不需確認，可復原上一步。</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy || !canUndo} onClick={() => void act('undo')} className="rounded-xl bg-slate-700 px-3 sm:px-4 py-2 text-xs sm:text-sm text-white disabled:opacity-40 whitespace-nowrap">復原上一步</button>
      <button disabled={busy || !pending.length} onClick={() => void act('fill')} className="rounded-xl bg-indigo-700 px-3 sm:px-4 py-2 text-xs sm:text-sm text-white disabled:opacity-40 whitespace-nowrap">演算法安排未分組成員</button>
      {onRerun && <button disabled={busy} onClick={() => { if (window.confirm('將重新安排所有成員並取代目前草稿，成員仍看到上次發布的結果。確定重排？')) onRerun(); }} className="rounded-xl border border-slate-600 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-300 disabled:opacity-40 whitespace-nowrap">全部重新分組</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-indigo-200">{notice}</p>}
    <div {...dropZone(null)}>
      <h4 className="font-bold text-amber-300">未分組（{pending.length} 人）</h4>
      <p className="text-xs text-slate-400">新加入的成員會出現在這裡，安排後需發布才會看到自己的組別。</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pending.map(p => member(p, null))}</div>
      {!pending.length && <p className="py-3 text-center text-sm text-slate-500">目前沒有未分組成員，也可將成員拖回這裡。</p>}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {result.groups.map(g => <div key={g.id} {...dropZone(g.id)}>
        <div className="flex justify-between gap-2"><h4 className="font-bold text-white">{g.name}</h4><span className="text-sm text-slate-300">{g.members.length} / {settings.maxGroupSize ?? 8} 人{hover === g.id && dragged && !g.memberIds.includes(dragged) ? ` → ${g.members.length + 1} 人` : ''}</span></div>
        {g.members.length < (settings.minGroupSize ?? 1) && <p className="text-xs text-amber-300">低於建議人數，可繼續調整或發布。</p>}
        <p className="text-xs text-indigo-300">角色 {Math.round(g.roleScore)} 分 · 曲風 {Math.round(g.musicScore)} 分</p>
        {g.members.map(p => member(p, g.id))}
        {!g.members.length && <p className="py-6 text-center text-slate-500">拖曳成員到這裡</p>}
        <p className="text-xs text-slate-300">建議分工：{g.roleAssignments?.map(a => `${getTagNameZh(a.role)}：${g.members.find(p => p.id === a.participantId)?.name}`).join('、') || '尚未配置'}</p>
        {g.diagnosticsZh.map((note, i) => <p key={i} className="text-xs text-slate-400">{note}</p>)}
        {g.consensusTags.length > 0 && <p className="text-xs text-purple-300">共識風格：{g.consensusTags.map(getTagNameZh).join('、')}</p>}
      </div>)}
    </div>
    <div className="text-xs text-slate-400 space-y-1">{result.warnings.map((w, i) => <p key={i} className="text-amber-300">{w}</p>)}{result.diagnostics.notesZh.map((n, i) => <p key={i}>{n}</p>)}</div>
    <div className="sticky bottom-3 rounded-2xl border border-indigo-500/40 bg-slate-950/95 p-2.5 sm:p-3 backdrop-blur flex items-center justify-between gap-2 sm:gap-3">
      <span className="flex-1 min-w-0 text-[11px] sm:text-xs text-slate-300 line-clamp-2">{busy ? '正在儲存…' : `${changed} 位成員的安排有變動 · ${pending.length} 人未分組`}</span>
      <button disabled={busy || !dirty} onClick={() => setConfirmPublish(true)} className="shrink-0 whitespace-nowrap rounded-xl bg-indigo-500 px-3 sm:px-4 py-2.5 sm:py-3 font-bold text-xs sm:text-sm text-white disabled:opacity-40">{publishedResult ? '發布更新' : '發布分組結果'}</button>
    </div>
    {confirmPublish && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="publish-title" onKeyDown={e => { if (e.key === 'Escape' && !busy) setConfirmPublish(false); }} className="max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 space-y-4">
        <h4 id="publish-title" className="text-xl font-bold text-white">確認發布分組結果</h4>
        <p className="text-slate-300">將發布 {result.groups.length} 組結果，{changed} 位成員的安排有變動。成員會立即看到這個版本。</p>
        {pending.length > 0 && <p className="text-amber-300">仍有 {pending.length} 位成員未分組，他們會繼續看到等待安排。</p>}
        <div className="flex justify-end gap-3"><button autoFocus disabled={busy} onClick={() => setConfirmPublish(false)} className="rounded-lg px-4 py-2 text-slate-300">繼續調整</button><button disabled={busy} onClick={() => void act('publish')} className="rounded-lg bg-indigo-500 px-4 py-2 text-white">{busy ? '發布中…' : '確認發布'}</button></div>
      </div>
    </div>}
  </section>;
}
