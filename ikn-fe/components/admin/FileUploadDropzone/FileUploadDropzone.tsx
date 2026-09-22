'use client';

import { useRef, useState, type DragEvent } from 'react';
import Icon from '@/components/Icon';
import styles from './FileUploadDropzone.module.css';

interface FileUploadDropzoneProps {
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  activeFilePath?: string;
  activeFileName?: string;
  helperText?: string;
}

export default function FileUploadDropzone({
  label = 'Unggah Dokumen',
  accept = '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png',
  maxSizeMB = 20,
  selectedFile,
  onFileSelect,
  activeFilePath,
  activeFileName,
  helperText = 'Format didukung: PDF, DOCX, PPT, PPTX (Maks 20MB)',
}: FileUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] || null;
      onFileSelect(file);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>
          {label}
        </span>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0] || null);
          }
        }}
      />

      {selectedFile ? (
        <div className={styles.fileCard}>
          <div className={styles.fileMeta}>
            <div className={styles.fileIcon}>
              <Icon name="leaf" size={18} />
            </div>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{selectedFile.name}</span>
              <span className={styles.fileSize}>{formatBytes(selectedFile.size)}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onFileSelect(null)}
          >
            Hapus File
          </button>
        </div>
      ) : (
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={styles.dropzoneIcon}>
            <Icon name="plus" size={18} />
          </div>
          <span className={styles.dropzoneText}>
            Geser & lepas file di sini, atau <strong>klik untuk memilih file</strong>
          </span>
          <span className={styles.dropzoneHint}>{helperText}</span>
        </div>
      )}

      {activeFilePath && !selectedFile && (
        <div className={styles.activeBadge}>
          <Icon name="checkCircle" size={15} style={{ color: 'var(--green)' }} />
          <span>File Aktif:</span>
          <a
            href={activeFilePath}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span>{activeFileName || activeFilePath}</span>
            <Icon name="arrow" size={13} style={{ transform: 'rotate(-45deg)' }} />
          </a>
        </div>
      )}
    </div>
  );
}

interface SegmentedRadioProps<T extends string> {
  name: string;
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (val: T) => void;
}

export function SegmentedRadio<T extends string>({
  name,
  options,
  value,
  onChange,
}: SegmentedRadioProps<T>) {
  return (
    <div className={styles.radioGroup}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`${styles.radioPill} ${isActive ? styles.radioPillActive : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isActive}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
