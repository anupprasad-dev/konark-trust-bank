import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Alert, Badge, Pagination, formatDay, formatINR } from "../components/ui.jsx";

describe("formatting helpers", () => {
  it("writes money in Indian style", () => {
    expect(formatINR(1234.5)).toMatch(/1,234\.50/);
    expect(formatINR(1234567)).toMatch(/12,34,567/);
    expect(formatINR(null)).toMatch(/0\.00/);
  });

  it("writes a plain date without a time zone shift", () => {
    expect(formatDay("1992-03-15")).toBe("15 Mar 1992");
    expect(formatDay("")).toBe("-");
  });
});

describe("Alert", () => {
  it("shows nothing without a message", () => {
    const { container } = render(<Alert>{""}</Alert>);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces an error", () => {
    render(<Alert>Something went wrong</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows a success message as a status", () => {
    render(<Alert type="success">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});

describe("Badge", () => {
  it("uses the kind as its text by default", () => {
    render(<Badge kind="pending" />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("is hidden when everything fits on one page", () => {
    const { container } = render(<Pagination page={1} count={7} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("moves between pages", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} count={25} onPage={onPage} />);
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});
