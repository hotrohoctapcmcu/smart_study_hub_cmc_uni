import { lazy, Suspense, Component } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  useRouteError,
} from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import {
  ErrorState,
  EmptyState,
  LoadingSkeleton,
  Button,
} from "./components/common/ui";
const pages = {
  Dashboard: lazy(() => import("./pages/Dashboard/Dashboard")),
  Schedule: lazy(() => import("./pages/Schedule/Schedule")),
  Tasks: lazy(() => import("./pages/Tasks/Tasks")),
  Learning: lazy(() => import("./pages/Learning/Learning")),
  Documents: lazy(() => import("./pages/Documents/Documents")),
  Notebooks: lazy(() => import("./pages/Notebooks/Notebooks")),
  AITutor: lazy(() => import("./pages/AITutor/AITutor")),
  Statistics: lazy(() => import("./pages/Statistics/Statistics")),
  Exams: lazy(() => import("./pages/Exams/Exams")),
  Email: lazy(() => import("./pages/Email/Email")),
  Sync: lazy(() => import("./pages/Sync/Sync")),
  Profile: lazy(() => import("./pages/Profile/Profile")),
  Settings: lazy(() => import("./pages/Settings/Settings")),
  Textbook: lazy(() => import("./pages/Textbook/Textbook")),
  TextbookEditor: lazy(() => import("./pages/Textbook/TextbookEditor")),
};
function RouteError() {
  const error = useRouteError();
  return (
    <div className="page">
      <ErrorState
        title="Không thể hiển thị trang"
        error={error}
        onRetry={() => window.location.reload()}
      />
      <Link to="/" className="btn btn-outline">
        Về tổng quan
      </Link>
    </div>
  );
}
const routes = [
  ["", "Dashboard"],
  ["schedule", "Schedule"],
  ["tasks", "Tasks"],
  ["learning", "Learning"],
  ["textbook", "Textbook"],
  ["textbook/:id", "TextbookEditor"],
  ["documents", "Documents"],
  ["notebooks", "Notebooks"],
  ["notebooks/:id", "Notebooks"],
  ["ai", "AITutor"],
  ["statistics", "Statistics"],
  ["exams", "Exams"],
  ["email", "Email"],
  ["sync", "Sync"],
  ["profile", "Profile"],
  ["settings", "Settings"],
];
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      ...routes.map(([path, name]) => {
        const Page = pages[name];
        return {
          ...(path ? { path } : { index: true }),
          element: (
            <Suspense
              fallback={
                <div className="page">
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                </div>
              }
            >
              <Page />
            </Suspense>
          ),
          errorElement: <RouteError />,
        };
      }),
      {
        path: "*",
        element: (
          <div className="page">
            <EmptyState
              title="Không tìm thấy trang"
              description="Đường dẫn này chưa tồn tại."
              action={
                <Link className="btn btn-primary" to="/">
                  Về tổng quan
                </Link>
              }
            />
          </div>
        ),
      },
    ],
  },
]);
export default function App() {
  return <RouterProvider router={router} />;
}
