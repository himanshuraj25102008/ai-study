export default function Loading() {
  return (
    <main className="shell" aria-busy="true" aria-label="Loading AI STUDY">
      <header className="topbar"><div className="skeleton-brand skeleton" /><div className="skeleton-actions"><span className="skeleton" /><span className="skeleton" /></div></header>
      <div className="layout">
        <aside className="sidebar skeleton-sidebar">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-nav skeleton" key={index} />)}</aside>
        <div className="main">
          <div className="skeleton-welcome"><div className="skeleton-line skeleton" /><div className="skeleton-title skeleton" /><div className="skeleton-line skeleton" /></div>
          <div className="grid">{Array.from({ length: 3 }, (_, index) => <div className="card skeleton-stat skeleton" key={index} />)}</div>
          <div className="content-grid"><div className="card skeleton-content skeleton" /><div className="card skeleton-content skeleton" /></div>
        </div>
      </div>
    </main>
  );
}
