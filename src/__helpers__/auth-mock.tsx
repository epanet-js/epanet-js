import { createContext, useContext } from "react";
import { User, nullUser } from "src/auth-types";

const AuthMockContext = createContext({ user: nullUser, isSignedIn: false });

export const AuthMockProvider = ({
  children,
  user = nullUser,
  isSignedIn = false,
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

export type UseAuthHook = () => {
  isSignedIn?: boolean;
  userId: string | null | undefined;
  user: User;
};
