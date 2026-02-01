import { useState, type ReactNode } from 'react';

interface CollapsibleCardProps {
  title: string;
  headerRight?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export default function CollapsibleCard({
  title,
  headerRight,
  defaultOpen = true,
  className,
  children
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`card ${className ?? ''} ${open ? '' : 'is-collapsed'}`}>
      <div className="card-header">
        <h2>{title}</h2>
        <div className="card-actions">
          {headerRight}
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {open ? children : null}
    </section>
  );
}
