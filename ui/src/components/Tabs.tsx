import { useEffect, useState, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  status?: 'ok' | 'error' | 'pending';
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
}

export default function Tabs({ items }: TabsProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  useEffect(() => {
    if (!items.find((item) => item.id === activeId)) {
      setActiveId(items[0]?.id ?? '');
    }
  }, [items, activeId]);

  const active = items.find((item) => item.id === activeId);

  return (
    <div className="tabs">
      <div className="tab-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab-button ${item.id === activeId ? 'active' : ''} ${
              item.status ? `is-${item.status}` : ''
            }`}
            onClick={() => setActiveId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{active?.content ?? <div className="muted">No tab</div>}</div>
    </div>
  );
}
