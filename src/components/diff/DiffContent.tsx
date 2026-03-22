import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DiffFile } from "../../lib";
import { parseDiff } from "../../lib";
import { DiffFileItem } from "./DiffFileItem";
import "./DiffContent.css";

interface DiffContentProps {
  hasTarget: boolean;
  targetPath: string | null;
  onFilesChanged: (count: number) => void;
}

export function DiffContent({ hasTarget, targetPath, onFilesChanged }: DiffContentProps) {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = useCallback(async () => {
    if (!targetPath) return;
    try {
      const raw = await invoke<string>("generate_unified_diff", {
        repoPath: targetPath,
      });
      const parsed = parseDiff(raw);
      setFiles(parsed);
      setError(null);
      onFilesChanged(parsed.length);
    } catch (err) {
      setError(String(err));
      setFiles([]);
      onFilesChanged(0);
    }
  }, [targetPath, onFilesChanged]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (hasTarget && targetPath) {
      fetchDiff();
    } else {
      setFiles([]);
      setError(null);
      onFilesChanged(0);
    }
  }, [hasTarget, targetPath, fetchDiff, onFilesChanged]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAccept = useCallback(
    async (path: string) => {
      if (!targetPath) return;
      try {
        await invoke("accept_file_changes", { repoPath: targetPath, paths: [path] });
        fetchDiff();
      } catch (err) {
        setError(String(err));
      }
    },
    [targetPath, fetchDiff],
  );

  const handleRevert = useCallback(
    async (path: string) => {
      if (!targetPath) return;
      try {
        await invoke("revert_file_changes", { repoPath: targetPath, paths: [path] });
        fetchDiff();
      } catch (err) {
        setError(String(err));
      }
    },
    [targetPath, fetchDiff],
  );

  if (!hasTarget) {
    return (
      <div className="diff-content">
        <p className="diff-content__empty">Set a local path to view changes</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diff-content">
        <p className="diff-content__error">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="diff-content">
        <p className="diff-content__empty">No changes to review</p>
      </div>
    );
  }

  return (
    <div className="diff-content diff-content--has-files">
      {files.map((file) => (
        <DiffFileItem key={file.path} file={file} onAccept={handleAccept} onRevert={handleRevert} />
      ))}
    </div>
  );
}
