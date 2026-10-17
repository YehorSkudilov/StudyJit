"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, FilePlus2, Loader2, UploadCloud } from "lucide-react";
import Modal from "@/components/ui/Modal";
import FileUploadPopup from "@/components/FileUploadPopup";
import { courseFiles, formatBytes, uploadFile, uploadYouTube, type CourseFile } from "@/lib/courses";

/** Picks files from the course for a study set, with an upload into the course for anything missing. */
export default function CourseFilePicker({
  isOpen,
  courseId,
  existingFileIds,
  onClose,
  onAddFiles,
}: {
  isOpen: boolean;
  courseId: number | null;
  existingFileIds: number[];
  onClose: () => void;
  onAddFiles: (files: { id: number; name: string; size: number }[]) => void;
}) {
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);

  const load = () => {
    if (courseId) courseFiles(courseId).then(setFiles, () => setFiles([]));
    else setFiles([]);
  };

  useEffect(() => {
    if (!isOpen) return;
    setPicked(new Set());
    load();
  }, [isOpen, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = (files ?? []).filter((f) => !existingFileIds.includes(f.id));
  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Modal isOpen={isOpen && !uploading} onClose={onClose} title="Add files" icon={<FilePlus2 className="w-5 h-5" />} width="max-w-lg">
        <div className="flex flex-col gap-4">
          {files === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : available.length === 0 ? (
            <p className="text-center text-muted py-6">
              {files.length ? "Every file in this course is already added." : "This course has no files yet. Upload some below."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{available.length} file{available.length === 1 ? "" : "s"} in this course</span>
                <button
                  className="font-semibold text-brand hover:underline"
                  onClick={() => setPicked(picked.size === available.length ? new Set() : new Set(available.map((f) => f.id)))}
                >
                  {picked.size === available.length ? "Select none" : "Select all"}
                </button>
              </div>
              <ul className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                {available.map((f, i) => {
                  const on = picked.has(f.id);
                  return (
                    <motion.li key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}>
                      <button
                        onClick={() => toggle(f.id)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          on ? "border-brand bg-brand-soft" : "border-stroke hover:bg-surface-2"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${on ? "bg-brand border-brand text-white" : "border-stroke"}`}>
                          {on && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium truncate">{f.name}</span>
                          <span className="block text-xs text-muted">{formatBytes(f.size)}</span>
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            {courseId && (
              <button onClick={() => setUploading(true)} className="btn-secondary">
                <UploadCloud className="w-4 h-4" /> Upload
              </button>
            )}
            <button
              className="btn-primary flex-1"
              disabled={picked.size === 0}
              onClick={() => {
                onAddFiles(available.filter((f) => picked.has(f.id)).map((f) => ({ id: f.id, name: f.name, size: f.size })));
                onClose();
              }}
            >
              Add {picked.size || ""} file{picked.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </Modal>

      {uploading && courseId && (
        <FileUploadPopup
          isOpen
          onClose={() => {
            setUploading(false);
            load();
          }}
          onFileUpload={(file, onProgress) => uploadFile(file, { courseId }, onProgress)}
          onYouTubeUpload={(url, onProgress) => uploadYouTube(url, courseId, onProgress)}
        />
      )}
    </>
  );
}
