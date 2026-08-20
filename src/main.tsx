import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppDataProvider } from "./app/contexts/AppDataContext";
import { router } from "./app/router";
import { Toaster } from "./app/components/ui/sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AppDataProvider>
    <RouterProvider router={router} />
    {/* 26 files call toast(); without this mounted, none of them render. */}
    <Toaster />
  </AppDataProvider>
);
