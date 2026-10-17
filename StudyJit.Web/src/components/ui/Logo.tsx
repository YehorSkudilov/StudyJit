import Image from "next/image";

/** The owl and the name, side by side. */
export default function Logo({ size = 36, showName = true, light = false }: { size?: number; showName?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/images/logo-square.png" alt="StudyJit" width={size} height={size} priority />
      {showName && (
        <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
          Study<span className="text-gradient">Jit</span>
        </span>
      )}
    </span>
  );
}
