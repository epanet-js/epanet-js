import { nanoid } from "nanoid";
import { createContext, useContext } from "react";
import { UseAuthHook, User, nullUser } from "src/auth-types";

const AuthMockContext = createContext({
  user: nullUser,
  isSignedIn: false,
  signOut: () => {},
  isLoaded: true,
});

export const aUser = (attributes: Partial<User> = {}): User => {
  const defaults: User = {
    id: nanoid(),
    email: "test@example.org",
    firstName: "John",
    lastName: "Doe",
    plan: "free",
    trialActivatedAt: null,
    trialEndsAt: null,
    hasUsedTrial: false,
  };
  return { ...defaults, ...attributes };
};

export const aGuestUser = () => ({ ...nullUser });

export const AuthMockProvider = ({
  children,
  user = aUser(),
  isSignedIn = true,
  isLoaded = true,
  signOut = vi.fn(),
}: {
  children: React.ReactNode;
  user?: User;
  isSignedIn?: boolean;
  signOut?: () => void;
  isLoaded?: boolean;
}) => {
  return (
    <AuthMockContext.Provider value={{ isLoaded, user, isSignedIn, signOut }}>
      {children}
    </AuthMockContext.Provider>
  );
};

export const useAuthMock: UseAuthHook = () => {
  const { isSignedIn, user, signOut, isLoaded } = useContext(AuthMockContext);

  return { isSignedIn, user, userId: user.id, signOut, isLoaded };
};
