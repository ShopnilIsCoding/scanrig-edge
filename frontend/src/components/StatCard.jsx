export default function StatCard({ label, value, note, tone = 'orange', icon: Icon }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-heading">
        <span>{label}</span>
        {Icon && <Icon size={18} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
