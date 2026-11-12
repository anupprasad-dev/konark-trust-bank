import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from "../api";
import NotificationBell from "../components/NotificationBell.jsx";

const reply = (unread, results) => api.get.mockResolvedValue({ data: { unread, results } });
const item = (id, title, is_read = false) => ({
  id, kind: "money_in", title, body: "From Ravi", is_read, created_at: new Date().toISOString(),
});

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: {} });
  });

  it("shows how many messages are unread", async () => {
    reply(2, [item(1, "Rs. 500.00 received"), item(2, "Card approved")]);
    render(<NotificationBell />);
    expect(await screen.findByRole("button", { name: /2 unread/i })).toBeInTheDocument();
  });

  it("opens the list and marks everything read", async () => {
    reply(2, [item(1, "Rs. 500.00 received"), item(2, "Card approved")]);
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: /2 unread/i }));

    expect(await screen.findByText("Rs. 500.00 received")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));

    expect(api.post).toHaveBeenCalledWith("/notifications/read/");
    await waitFor(() => expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument());
  });

  it("marks one message read when it is clicked", async () => {
    reply(1, [item(7, "Loan approved")]);
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: /1 unread/i }));
    fireEvent.click(await screen.findByText("Loan approved"));
    expect(api.post).toHaveBeenCalledWith("/notifications/7/read/");
  });

  it("says you are caught up when there is nothing", async () => {
    reply(0, []);
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});
