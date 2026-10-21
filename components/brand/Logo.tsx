import clsx from 'clsx';

/** Sutra mark: three threads that shorten as progress narrows, the middle one in gold. */
export function Mark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx('flex flex-col gap-[3px]', className)}>
      <i className="block h-[3px] w-full bg-ink" />
      <i className="block h-[3px] w-[72%] bg-gold" />
      <i className="block h-[3px] w-[44%] bg-ink" />
    </span>
  );
}

/** Sutra is the product; "by Emporum" is a quiet secondary line and is deliberately small. */
export function Logo({ size = 'md', showAttribution = true }: { size?: 'md' | 'lg'; showAttribution?: boolean }) {
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center gap-3">
      <Mark className={lg ? 'w-9' : 'w-6'} />
      <span className="flex flex-col leading-none">
        <span className={clsx('font-semibold tracking-[0.16em]', lg ? 'text-3xl' : 'text-[17px]')}>Sutra</span>
        {showAttribution && <span className={clsx('font-mono text-muted', lg ? 'mt-2 text-[11px] tracking-[0.14em]' : 'mt-1 text-[9.5px] tracking-[0.14em]')}>by Emporum</span>}
      </span>
    </span>
  );
}
