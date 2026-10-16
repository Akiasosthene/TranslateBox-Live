import { describe, it, expect } from "vitest";
import { completeOnly } from "./captions";

describe("completeOnly", () => {
  it("keeps finished sentences and hides the one being spoken", () => {
    expect(completeOnly("Hello world. This is")).toBe("Hello world.");
    expect(completeOnly("Bonjour ! Ça va")).toBe("Bonjour !");
    expect(completeOnly("No end yet")).toBe("");
    expect(completeOnly("A.\n\nB is")).toBe("A.");
    expect(completeOnly("It costs 3.5 dollars")).toBe("");
    expect(completeOnly("你好。我是")).toBe("你好。");
  });
});
