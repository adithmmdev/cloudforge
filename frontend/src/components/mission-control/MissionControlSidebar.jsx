import React from 'react';
import { Activity, BarChart3, Bot, LayoutPanelTop, ListTodo } from 'lucide-react';

const sections = [
  { id: 'mc-overview', label: 'System state', icon: LayoutPanelTop },
  { id: 'mc-active', label: 'Active operations', icon: Activity },
  { id: 'mc-autonomy', label: 'Autonomy', icon: Bot },
  { id: 'mc-observability', label: 'Observability', icon: BarChart3 },
  { id: 'mc-projects', label: 'Projects', icon: ListTodo },
];

export default function MissionControlSidebar() {
  const scrollToSection = (event, id) => {
    event.preventDefault();
    const section = document.getElementById(id);
    if (!section) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <aside className="mc-sidebar" aria-label="Mission Control sections">
      <p className="mc-sidebar-title">Mission Control</p>
      <nav className="mc-sidebar-nav">
        {sections.map(({ id, label, icon: Icon }) => (
          <a key={id} className="mc-sidebar-link" href={`#${id}`} onClick={(event) => scrollToSection(event, id)}>
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <p className="mc-sidebar-note">Live project state is synchronized through the existing control stream.</p>
    </aside>
  );
}
