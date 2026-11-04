/** "01 / TITLE" breadcrumb bar with the 2px structural rule underneath. */
export function PageHeader({ step, title, status, action }: { step?: string; title: string; status?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <h1 className="path !m-0">{step ? `${step} / ${title}` : title}</h1>
      {action ? action : status && <span className="status">● {status}</span>}
    </div>
  );
}
