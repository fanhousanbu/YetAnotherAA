import { User } from "./types";

export const getStoredAuth = (): { token: string | null; user: User | null } => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  return { token, user };
};

export const setStoredAuth = (token: string, user: User) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // Clear cached dashboard data
  sessionStorage.removeItem("dashboardData");
  sessionStorage.removeItem("dashboardDataLoaded");
};

export const isAuthenticated = (): boolean => {
  const { token } = getStoredAuth();
  return !!token;
};
