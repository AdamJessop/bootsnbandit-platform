/**
 * STUB — Image uploader for gallery / flash / headshots (component kit,
 * BACKOFHOUSE-IA J1/J2/J3). Wave-4 content phase wires upload + preview +
 * reorder. Prop interface is the stable contract.
 */

export interface ImageUploaderProps {
  /** Current image URL(s). String for single, array for multi. */
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  /** Accept filter, e.g. "image/png,image/jpeg". */
  accept?: string;
  /** Allow selecting multiple images. */
  multiple?: boolean;
}

export function ImageUploader({ value, accept }: ImageUploaderProps) {
  const count = Array.isArray(value) ? value.length : value ? 1 : 0;
  return (
    <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-raised p-8 text-center text-sm text-text-muted">
      <p className="font-termina uppercase tracking-wide">Upload image</p>
      <p>
        {count} selected{accept ? ` · ${accept}` : ""}. Uploader implementation
        lands in Wave 4.
      </p>
    </div>
  );
}
