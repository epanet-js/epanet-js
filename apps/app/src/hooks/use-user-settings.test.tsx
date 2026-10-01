import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { localizeDecimal } from "@epanet-js/i18n";
import type { Locale } from "@epanet-js/i18n/locale";
import { User } from "src/auth-types";
import { localeAtom } from "src/state/locale";
import {
  AuthMockProvider,
  aGuestUser,
  aUser,
  useAuthMock,
} from "src/__helpers__/auth-mock";
import { useUserSettings } from "./use-user-settings";

vi.mock("src/hooks/use-auth", () => ({ useAuth: () => useAuthMock() }));

const renderSettings = ({
  localLocale,
  user,
  isSignedIn,
}: {
  localLocale: Locale;
  user: User;
  isSignedIn: boolean;
}) => {
  const store = createStore();
  store.set(localeAtom, localLocale);
  const hook = renderHook(() => useUserSettings(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <JotaiProvider store={store}>
        <AuthMockProvider user={user} isSignedIn={isSignedIn}>
          {children}
        </AuthMockProvider>
      </JotaiProvider>
    ),
  });
  return { ...hook, store };
};

describe("useUserSettings", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("uses the account locale and keeps the local one in step with it", async () => {
    const user = aUser({ getLocale: () => "es", setLocale: vi.fn() });

    const { result, store } = renderSettings({
      localLocale: "fr",
      user,
      isSignedIn: true,
    });

    expect(result.current.locale).toEqual("es");
    await waitFor(() => expect(store.get(localeAtom)).toEqual("es"));
    expect(user.setLocale).not.toHaveBeenCalled();
  });

  it("formats numbers in the interface locale after signing out and in again", async () => {
    const user = aUser({ getLocale: () => "en", setLocale: vi.fn() });
    const store = createStore();
    store.set(localeAtom, "es");
    const authState = { isSignedIn: false };
    const { rerender } = renderHook(() => useUserSettings(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <JotaiProvider store={store}>
          <AuthMockProvider
            user={authState.isSignedIn ? user : aGuestUser()}
            isSignedIn={authState.isSignedIn}
          >
            {children}
          </AuthMockProvider>
        </JotaiProvider>
      ),
    });
    expect(localizeDecimal(150.5)).toEqual("150,5");

    authState.isSignedIn = true;
    rerender();
    await waitFor(() => expect(localizeDecimal(150.5)).toEqual("150.5"));

    authState.isSignedIn = false;
    rerender();
    localStorage.clear();
    expect(localizeDecimal(150.5)).toEqual("150.5");

    authState.isSignedIn = true;
    rerender();
    expect(localizeDecimal(150.5)).toEqual("150.5");
  });

  it("saves the locale chosen while signed out to an account without one", async () => {
    const user = aUser({
      getLocale: () => undefined,
      setLocale: vi.fn().mockResolvedValue(undefined),
    });

    const { result } = renderSettings({
      localLocale: "fr",
      user,
      isSignedIn: true,
    });

    expect(result.current.locale).toEqual("fr");
    await waitFor(() => expect(user.setLocale).toHaveBeenCalledWith("fr"));
    expect(user.setLocale).toHaveBeenCalledTimes(1);
  });

  it("saves a change to the account when signed in", async () => {
    const user = aUser({
      getLocale: () => "es",
      setLocale: vi.fn().mockResolvedValue(undefined),
    });
    const { result } = renderSettings({
      localLocale: "es",
      user,
      isSignedIn: true,
    });

    await act(() => result.current.setLocale("nl"));

    expect(user.setLocale).toHaveBeenCalledWith("nl");
  });

  it("saves a change locally when signed out", async () => {
    const { result, store } = renderSettings({
      localLocale: "en",
      user: aGuestUser(),
      isSignedIn: false,
    });

    await act(() => result.current.setLocale("fr"));

    expect(result.current.locale).toEqual("fr");
    expect(store.get(localeAtom)).toEqual("fr");
  });

  it("keeps the signed-out choice in session storage only", async () => {
    const { result } = renderSettings({
      localLocale: "en",
      user: aGuestUser(),
      isSignedIn: false,
    });

    await act(() => result.current.setLocale("fr"));

    expect(sessionStorage.getItem("locale")).toEqual(JSON.stringify("fr"));
    expect(localStorage.getItem("locale")).toBeNull();
  });
});
