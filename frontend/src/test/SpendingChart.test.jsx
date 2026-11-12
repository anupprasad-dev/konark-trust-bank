import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SpendingChart from "../components/SpendingChart.jsx";

const months = (values) =>
  ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((label, i) => ({ label, credit: values[i]?.[0] ?? 0, debit: values[i]?.[1] ?? 0 }));

describe("SpendingChart", () => {
  it("asks for a first transaction when there is no data", () => {
    render(<SpendingChart data={{ months: months([]), this_month: { credit: 0, debit: 0 }, breakdown: [] }} />);
    expect(screen.getByText(/appears here after your first transaction/i)).toBeInTheDocument();
  });

  it("shows months and where this month's money went", () => {
    render(
      <SpendingChart
        data={{
          months: months([[], [], [], [], [5000, 1200], [0, 800]]),
          this_month: { credit: 0, debit: 800 },
          breakdown: [
            { label: "Transfers", amount: 500 },
            { label: "Bills and recharges", amount: 300 },
          ],
        }}
      />
    );
    expect(screen.getByText("Nov")).toBeInTheDocument();
    expect(screen.getByText("Transfers")).toBeInTheDocument();
    expect(screen.getByText("Bills and recharges")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /last 6 months/i })).toBeInTheDocument();
  });
});
