export default function AuthHeading({ title, children }) {
  return (
    <header className="auth-heading">
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}
