export type Ticket = {
  id: string;
  title: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high";
};
