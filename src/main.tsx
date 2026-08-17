import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppDataProvider } from "./app/contexts/AppDataContext";
import { router } from "./app/router";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AppDataProvider>
    <RouterProvider router={router} />
  </AppDataProvider>
);
