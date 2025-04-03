import { nanoid } from "nanoid";
import { createContext, useContext } from "react";
import { UseAuthHook, User, nullUser } from "src/auth-types";

const AuthMockContext = createContext({ user: nullUser, isSignedIn: false });

export const aUser = (attributes: Partial<User> = {}): User => {
  const defaults: User = {
    id: nanoid(),
    email: "test@example.org",
    firstName: "John",
    lastName: "Doe",
    plan: "free",
  };
  return { ...defaults, ...attributes };
};

export const aGuestUser = () => ({ ...nullUser });

export const AuthMockProvider = ({
  children,
  user = aUser(),
  isSignedIn = true,
}: {
  children: React.ReactNode;
  user?: User;
  isSignedIn?: boolean;
}) => {
  return (
    <AuthMockContext.Provider value={{ user, isSignedIn }}>
      {children}
    </AuthMockContext.Provider>
  );
};

export const useAuthMock: UseAuthHook = () => {
  const { isSignedIn, user } = useContext(AuthMockContext);

  return { isSignedIn, user, userId: user.id };
};
