"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadRecordsFromStorage,
  deleteRecordFromStorage,
  saveRecordToStorage,
  renameRecord,
  importRecord,
  exportRecord,
  type GameRecord,
} from "@/lib/gameRecorder";

interface Props {
  onReplay: (record: GameRecord) => void;
}

export function SavedGames({ onReplay }: Props) {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    setRecords(loadRecordsFromStorage());
  }, []);

  const completed = records.filter((r) => r.metadata.result !== "InProgress");
  const inProgress = records.filter((r) => r.metadata.result === "InProgress");
  const displayed = showCompleted ? completed : inProgress;

  const handleDelete = useCallback((id: string) => {
    deleteRecordFromStorage(id);
    setRecords(loadRecordsFromStorage());
  }, []);

  const handleRename = useCallback(
    (record: GameRecord) => {
      if (!editName.trim()) return;
      const updated = renameRecord(record, editName.trim());
      saveRecordToStorage(updated);
      setRecords(loadRecordsFromStorage());
      setEditingId(null);
    },
    [editName]
  );

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const record = await importRecord(file);
        saveRecordToStorage(record);
        setRecords(loadRecordsFromStorage());
        onReplay(record);
      } catch (err) {
        alert(`Failed to import: ${err}`);
      }
      e.target.value = "";
    },
    [onReplay]
  );

  if (records.length === 0) {
    return (
      <div className="space-y-3">
        <label className="inline-block px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
          Import .hive File
          <input
            type="file"
            accept=".hive,.json"
            className="hidden"
            onChange={handleImport}
          />
        </label>
        <p className="text-zinc-600 text-xs">No saved games yet. Play a game and it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setShowCompleted(false)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            !showCompleted
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
          }`}
        >
          In Progress ({inProgress.length})
        </button>
        <button
          onClick={() => setShowCompleted(true)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            showCompleted
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
          }`}
        >
          Completed ({completed.length})
        </button>
        <label className="ml-auto px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 cursor-pointer transition-colors">
          Import
          <input
            type="file"
            accept=".hive,.json"
            className="hidden"
            onChange={handleImport}
          />
        </label>
      </div>

      {/* Game list */}
      {displayed.length === 0 ? (
        <p className="text-zinc-600 text-xs py-2">
          {showCompleted ? "No completed games." : "No games in progress."}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {displayed
            .slice()
            .reverse()
            .map((record) => (
              <GameRow
                key={record.id}
                record={record}
                isEditing={editingId === record.id}
                editName={editingId === record.id ? editName : ""}
                onStartEdit={() => {
                  setEditingId(record.id);
                  setEditName(record.name);
                }}
                onEditNameChange={setEditName}
                onSaveEdit={() => handleRename(record)}
                onCancelEdit={() => setEditingId(null)}
                onReplay={() => onReplay(record)}
                onExport={() => exportRecord(record)}
                onDelete={() => handleDelete(record.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function GameRow({
  record,
  isEditing,
  editName,
  onStartEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onReplay,
  onExport,
  onDelete,
}: {
  record: GameRecord;
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onEditNameChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onReplay: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const isInProgress = record.metadata.result === "InProgress";
  const date = new Date(record.metadata.date).toLocaleDateString();

  // Count deployed pieces from board grid
  const boardPieceCount = Object.values(record.metadata.rules.piece_counts || {}).reduce(
    (sum, v) => sum + (v as number),
    0
  );

  const resultBadge = isInProgress ? (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
      {record.metadata.totalMoves} moves
    </span>
  ) : (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${
        record.metadata.result === "Draw"
          ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
          : record.metadata.result === "WhiteWins"
            ? "bg-zinc-200/10 text-zinc-300 border border-zinc-400/30"
            : "bg-zinc-600/10 text-zinc-400 border border-zinc-500/30"
      }`}
    >
      {record.metadata.result === "WhiteWins"
        ? "White Won"
        : record.metadata.result === "BlackWins"
          ? "Black Won"
          : "Draw"}{" "}
      ({record.metadata.totalMoves} moves)
    </span>
  );

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors group">
      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              className="bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-32 focus:outline-none focus:border-amber-500"
              autoFocus
            />
            <button onClick={onSaveEdit} className="text-[10px] text-green-400 hover:text-green-300">
              Save
            </button>
          </div>
        ) : (
          <button onClick={onStartEdit} className="text-xs font-medium text-zinc-300 hover:text-zinc-100 truncate block text-left" title="Click to rename">
            {record.name}
          </button>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-zinc-600">{date}</span>
          <span className="text-[10px] text-zinc-600">
            {record.metadata.whitePlayer} vs {record.metadata.blackPlayer}
          </span>
          {resultBadge}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onReplay}
          className="px-2 py-1 text-[10px] rounded border border-amber-700/50 text-amber-400 hover:border-amber-500 transition-colors"
        >
          Replay
        </button>
        <button
          onClick={onExport}
          className="px-2 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Export
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-[10px] rounded border border-red-900/50 text-red-500/70 hover:border-red-700 hover:text-red-400 transition-colors"
        >
          Del
        </button>
      </div>
    </div>
  );
}
