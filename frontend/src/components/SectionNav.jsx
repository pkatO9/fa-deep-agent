import { Compass } from 'lucide-react';

export function SectionNav() {
  return (
    <nav className="section-nav" aria-label="Report sections">
      <a href="#snapshot" className="section-nav-link"><Compass size={14} /> Snapshot</a>
      <a href="#risk" className="section-nav-link">Risk</a>
      <a href="#allocation" className="section-nav-link">Allocation</a>
      <a href="#behavior" className="section-nav-link">Behavior</a>
      <a href="#strategy" className="section-nav-link">Strategy</a>
      <a href="#executive" className="section-nav-link">Executive</a>
    </nav>
  );
}
