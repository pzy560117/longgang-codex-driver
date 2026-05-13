import type { Meta, StoryObj } from "@storybook/react";
import { TicketFilterBar } from "../packages/ui/TicketFilterBar";

const meta = {
  title: "Ticket Filter/TicketFilterBar",
  component: TicketFilterBar,
  args: {
    value: {
      status: "open",
      priority: "high",
    },
    onChange: () => {},
    onSaveView: () => {},
  },
} satisfies Meta<typeof TicketFilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dirty: Story = {
  args: {
    dirty: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
