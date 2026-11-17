export default function PageHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <header className="feature-head">
      <div className="feature-head-text">
        {Icon && <span className="feature-head-ico"><Icon size={22} /></span>}
        <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      </div>
      {action}
    </header>
  );
}
