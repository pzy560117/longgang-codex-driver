/**
 * Example generated client output.
 * In a real project this file should be generated from contracts/openapi.yaml by Orval.
 */

export type Ticket = {
  id: string;
  title: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high";
};

export type ListTicketsParams = {
  status?: Ticket["status"];
  priority?: Ticket["priority"];
  assigneeId?: string;
};

export async function listTickets(params: ListTicketsParams): Promise<Ticket[]> {
  const query = new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {}),
  );

  const response = await fetch(`/tickets?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list tickets: ${response.status}`);
  }

  return response.json();
}
