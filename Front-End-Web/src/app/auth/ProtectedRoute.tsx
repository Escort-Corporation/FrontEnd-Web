import { Navigate, useLocation } from "react-router";
import { useAuth, type AccountKind, type Role } from "./AuthContext";

type ProtectedRouteProps = {
  children: JSX.Element;
  roles?: Role[];
  /** Restringe alem do perfil: ex. so a ESF (`shipper`) ou so a ECF (`carrier`). */
  kinds?: AccountKind[];
};

export function ProtectedRoute({ children, roles, kinds }: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  if (kinds && (!user || !kinds.includes(user.kind))) {
    return <Navigate to="/" replace />;
  }

  return children;
}
