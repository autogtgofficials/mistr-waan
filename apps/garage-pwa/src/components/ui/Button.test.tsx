import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Accept job</Button>);
    expect(screen.getByRole("button", { name: "Accept job" })).toBeInTheDocument();
  });

  it("defaults to type=button", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("calls onClick when clicked", async () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows spinner and is disabled when loading", () => {
    render(<Button loading>Accept job</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(screen.queryByText("Accept job")).not.toBeInTheDocument();
  });

  it("does not fire onClick when disabled", async () => {
    const handler = vi.fn();
    render(<Button disabled onClick={handler}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("applies w-full by default and not when inline", () => {
    const { rerender } = render(<Button>Full</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");

    rerender(<Button inline>Inline</Button>);
    expect(screen.getByRole("button").className).not.toContain("w-full");
  });
});
