import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import LearnerDashboard from "@/pages/LearnerDashboard";
import GuardDashboard from "@/pages/GuardDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

const roleHome = { learner: "/learner", guard: "/guard", admin: "/admin" };

const Protected = ({ role, children }) => {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-primary pulse-dot" />
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={roleHome[user.role]} replace />;
  return children;
};

const RootRedirect = () => {
  const { user } = useAuth();
  if (user === null) return null;
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome[user.role]} replace />;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/learner" element={<Protected role="learner"><LearnerDashboard /></Protected>} />
            <Route path="/guard" element={<Protected role="guard"><GuardDashboard /></Protected>} />
            <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
