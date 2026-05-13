type TicketFilter = {
  status?: "open" | "pending" | "resolved";
  priority?: "low" | "medium" | "high";
  assigneeId?: string;
};

type TicketFilterBarProps = {
  value: TicketFilter;
  dirty?: boolean;
  loading?: boolean;
  onChange: (next: TicketFilter) => void;
  onSaveView?: () => void;
};

export function TicketFilterBar({
  value,
  dirty = false,
  loading = false,
  onChange,
  onSaveView,
}: TicketFilterBarProps) {
  return (
    <section aria-label="Ticket filters">
      <div>
        <label>
          Status
          <select
            value={value.status ?? ""}
            disabled={loading}
            onChange={(event) =>
              onChange({
                ...value,
                status: (event.target.value || undefined) as TicketFilter["status"],
              })
            }
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>

        <label>
          Priority
          <select
            value={value.priority ?? ""}
            disabled={loading}
            onChange={(event) =>
              onChange({
                ...value,
                priority: (event.target.value || undefined) as TicketFilter["priority"],
              })
            }
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <div>
        {dirty ? <span>Unsaved filter changes</span> : <span>Filters synced</span>}
        <button type="button" disabled={loading || !onSaveView} onClick={onSaveView}>
          Save view
        </button>
      </div>
    </section>
  );
}
