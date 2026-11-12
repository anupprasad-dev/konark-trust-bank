import { beforeEach, describe, expect, it } from "vitest";
import { notice, tokens } from "../api";

describe("login storage", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the login in this tab and clears it on logout", () => {
    tokens.save("access-1", "refresh-1", { username: "asha" });
    expect(tokens.access()).toBe("access-1");
    expect(tokens.refresh()).toBe("refresh-1");
    expect(tokens.user()).toEqual({ username: "asha" });
    tokens.clear();
    expect(tokens.access()).toBeNull();
    expect(tokens.user()).toBeNull();
  });

  it("never writes the login to localStorage", () => {
    tokens.save("a", "r", { username: "asha" });
    expect(localStorage.getItem("ktb_access")).toBeNull();
  });
});

describe("login page notice", () => {
  beforeEach(() => sessionStorage.clear());

  it("is shown once and then gone", () => {
    notice.set("Your session ended. Please log in again.");
    expect(notice.take()).toBe("Your session ended. Please log in again.");
    expect(notice.take()).toBe("");
  });
});
