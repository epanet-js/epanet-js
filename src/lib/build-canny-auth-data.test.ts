import { expect, describe, it } from "vitest";
import { buildCannyAuthData } from "./build-canny-auth-data";
import { User } from "@clerk/nextjs/server";

const createMockUser = (overrides: Partial<User> = {}): User => {
  return {
    id: "user_2abcdefghijklmnopqrstuvwxyz",
    firstName: null,
    lastName: null,
    username: null,
    imageUrl: "https://example.com/avatar.png",
    emailAddresses: [
      {
        emailAddress: "test@example.com",
        id: "email_123",
        linkedTo: [],
        verification: null,
      },
    ],
    ...overrides,
  } as User;
};

describe("buildCannyAuthData", () => {
  it("uses firstName when only firstName provided", () => {
    const user = createMockUser({ firstName: "John" });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("John");
    expect(result.id).toBe(user.id);
    expect(result.email).toBe("test@example.com");
    expect(result.avatarURL).toBe("https://example.com/avatar.png");
  });

  it("uses firstName and first letter of lastName when both provided", () => {
    const user = createMockUser({
      firstName: "John",
      lastName: "Doe",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("John D.");
  });

  it("handles multi-character lastName correctly", () => {
    const user = createMockUser({
      firstName: "Jane",
      lastName: "Smith",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("Jane S.");
  });

  it("uses fallback format when no firstName or lastName", () => {
    const user = createMockUser({
      id: "user_2abcdefghijklmnopqrstuvwxyz",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("epanet-js anonymous user (#2abcde)");
  });

  it("handles user ID without user_ prefix", () => {
    const user = createMockUser({
      id: "custom_id_123456789",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("epanet-js custom");
  });

  it("handles short user ID", () => {
    const user = createMockUser({
      id: "user_abc",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("epanet-js anonymous user (#abc)");
  });

  it("trims whitespace from firstName", () => {
    const user = createMockUser({
      firstName: "  John  ",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("John");
  });

  it("trims whitespace from lastName", () => {
    const user = createMockUser({
      firstName: "John",
      lastName: "  Doe  ",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("John D.");
  });

  it("handles empty firstName as no firstName", () => {
    const user = createMockUser({
      firstName: "   ",
      lastName: "Doe",
      id: "user_2abcdefghijklmnopqrstuvwxyz",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("epanet-js anonymous user (#2abcde)");
  });

  it("handles empty lastName correctly", () => {
    const user = createMockUser({
      firstName: "John",
      lastName: "   ",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("John");
  });

  it("handles missing email addresses array", () => {
    const user = createMockUser({
      firstName: "John",
      emailAddresses: [],
    });
    const result = buildCannyAuthData(user);

    expect(result.email).toBeUndefined();
    expect(result.name).toBe("John");
  });

  it("uses real Clerk user ID format", () => {
    const user = createMockUser({
      id: "user_2nXXXXXXXXXXXXXXXXXXXXXXXX",
    });
    const result = buildCannyAuthData(user);

    expect(result.name).toBe("epanet-js anonymous user (#2nXXXX)");
  });
});
