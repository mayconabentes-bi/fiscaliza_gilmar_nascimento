type BrandMarkProps = {
  className?: string;
};

type BrandWordmarkProps = {
  className?: string;
};

type BrandLockupProps = {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
};

export function FiscalizeBrandMark({ className = "h-10 w-10" }: BrandMarkProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] ${className}`} aria-hidden="true">
      <img src="/app-icon.svg" alt="" className="h-full w-full object-cover" />
    </span>
  );
}

export function FiscalizeWordmark({ className = "" }: BrandWordmarkProps) {
  return (
    <span aria-label="FISCALIZE" className={`font-extrabold tracking-[-0.045em] text-[#1f2e6e] ${className}`}>
      <span aria-hidden="true">FISC<span className="text-[#f36a10]">A</span>LIZE</span>
    </span>
  );
}

export function FiscalizeLockup({
  className = "",
  markClassName = "h-10 w-10",
  wordClassName = "text-lg",
}: BrandLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <FiscalizeBrandMark className={markClassName} />
      <FiscalizeWordmark className={wordClassName} />
    </span>
  );
}
