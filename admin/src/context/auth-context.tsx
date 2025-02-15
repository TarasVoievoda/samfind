import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { jwtDecode } from "jwt-decode";
import { userApiService } from "@/services";
import { User } from "@/types";

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  userLoading: boolean;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
}

let logoutTimer: any;

const calculateRemainingTime = (expirationTime: number) => {
  const currentTime = new Date().getTime();

  return expirationTime - currentTime;
};

export const AuthContext = React.createContext({} as AuthContextType);

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const localStorageToken = localStorage.getItem("accessToken");
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorageToken
  );
  const [userLoading, setUserLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);

    localStorage.removeItem("accessToken");
    localStorage.removeItem("expirationTime");
    localStorage.removeItem("refreshToken");

    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }

    navigate("/login");
  }, []);

  const login = (accessToken: string, refreshToken: string) => {
    setAccessToken(accessToken);

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    const decodedToken = jwtDecode<{ exp: number }>(refreshToken);
    const expirationTime = decodedToken.exp * 1000;

    localStorage.setItem("expirationTime", expirationTime.toString());

    const remainingTime = calculateRemainingTime(expirationTime);

    logoutTimer = setTimeout(logout, remainingTime);
  };

  useEffect(() => {
    const localStorageToken = localStorage.getItem("accessToken");

    if (accessToken) {
      const expirationTime = Number(localStorage.getItem("expirationTime"));
      const remainingTime = calculateRemainingTime(expirationTime);

      if (remainingTime > 0) {
        setAccessToken(localStorageToken);

        const decodedToken = jwtDecode<{ sub: string }>(localStorageToken!);

        const fetchUser = async () => {
          setUserLoading(true);

          try {
            const userData = await userApiService.findUserById(decodedToken.sub);
            setUser(userData as User);
          } catch (error) {
            console.error("Failed to fetch user data:", error);
          } finally {
            setUserLoading(false);
          }
        };

        fetchUser();
        
        logoutTimer = setTimeout(logout, remainingTime);
      } else {
        logout();
      }
    }
  }, [accessToken, logout]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: accessToken !== null,
        user,
        userLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
