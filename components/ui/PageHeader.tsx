/** "01 / TITLE" breadcrumb bar with the 2px structural rule underneath. */
export function PageHeader({ step, title, status }: { step?: string; title: string; status?: string }) {
  return (
    <div className="page-header">
      <h1 className="path !m-0">{step ? `${step} / ${title}` : title}</h1>
      {status && <span className="status">● {status}</span>}
    </div>
  );
}
