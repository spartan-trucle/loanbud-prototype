import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { CRMLayout } from "./layouts/CRMLayout";
import { EmailWorkflowsLayout } from "./layouts/EmailWorkflowsLayout";
import { PlaceholderView } from "./components/ui/PlaceholderView";
import { User, Zap, ClipboardList, Sliders } from "lucide-react";

/**
 * Route-level code splitting. Layouts stay eager (they render on every route);
 * each screen is fetched on first navigation, so the initial download only
 * carries the shell plus the landing route.
 */
function lazyRoute<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  exportName: keyof M & string,
) {
  return async () => ({
    Component: (await load())[exportName] as ComponentType,
  });
}

const applications = () => import("./components/applications");
const crm = () => import("./components/crm");
const campaigns = () => import("./components/crm/campaigns");
const emailWorkflows = () => import("./components/email-workflows");

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <RootLayout />,
      children: [
        { index: true, element: <Navigate to="/applications" replace /> },
        { path: "applications", lazy: lazyRoute(applications, "ApplicationList") },
        {
          path: "business-acquisition",
          lazy: lazyRoute(applications, "BusinessAcquisitionList"),
        },
        { path: "users", element: <PlaceholderView icon={User} title="Users" /> },
        { path: "automations", element: <PlaceholderView icon={Zap} title="Automations" /> },
        { path: "questionnaires", element: <PlaceholderView icon={ClipboardList} title="Questionnaires" /> },
        { path: "configurations", element: <PlaceholderView icon={Sliders} title="Configurations" /> },

        // CRM section
        {
          path: "crm",
          element: <CRMLayout />,
          children: [
            { index: true, element: <Navigate to="/crm/contacts" replace /> },
            { path: "contacts", lazy: lazyRoute(crm, "ContactList") },
            { path: "contacts/:id", lazy: lazyRoute(crm, "ContactDetail") },
            { path: "campaigns", lazy: lazyRoute(campaigns, "CampaignList") },
            { path: "campaigns/:id", lazy: lazyRoute(campaigns, "CampaignDetail") },
            { path: "lead-form", lazy: lazyRoute(crm, "LeadFormIngest") },
            { path: "companies", lazy: lazyRoute(crm, "CompanyList") },
            { path: "listings", lazy: lazyRoute(crm, "ListingList") },
            { path: "tasks", lazy: lazyRoute(emailWorkflows, "TaskQueue") },
            // Segments (moved from email-workflows)
            {
              path: "segments",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/UserSegmentsV2"),
                "UserSegmentsV2",
              ),
            },
            {
              path: "segments/:id",
              lazy: lazyRoute(
                () => import("./components/email-workflows/SegmentDetail"),
                "SegmentDetail",
              ),
            },
            {
              path: "segments/builder",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/SegmentBuilderV2"),
                "SegmentBuilderV2",
              ),
            },
            // Workflows (moved from email-workflows)
            { path: "workflows", lazy: lazyRoute(emailWorkflows, "WorkflowList") },
            {
              path: "workflows/new",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBuilderV2"),
                "WorkflowBuilderV2",
              ),
            },
            {
              path: "workflows/:id/edit",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBuilderV2"),
                "WorkflowBuilderV2",
              ),
            },
            {
              path: "workflows/:id/board",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBoardV2"),
                "WorkflowBoardV2",
              ),
            },
            // Inbox (email + SMS conversations)
            { path: "inbox", lazy: lazyRoute(crm, "InboxPage") },
            // Settings (combined CRM + workflow config)
            { path: "settings", lazy: lazyRoute(crm, "CRMSettings") },
          ],
        },

        // Email Workflows section
        {
          path: "email-workflows",
          element: <EmailWorkflowsLayout />,
          children: [
            { index: true, element: <Navigate to="/email-workflows/flows" replace /> },
            { path: "flows", lazy: lazyRoute(emailWorkflows, "WorkflowList") },
            {
              path: "flows/new",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBuilderV2"),
                "WorkflowBuilderV2",
              ),
            },
            {
              path: "flows/:id/edit",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBuilderV2"),
                "WorkflowBuilderV2",
              ),
            },
            {
              path: "flows/:id/board",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/WorkflowBoardV2"),
                "WorkflowBoardV2",
              ),
            },
            { path: "flow-builder", lazy: lazyRoute(emailWorkflows, "FlowBuilder") },
            {
              path: "user-segments",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/UserSegmentsV2"),
                "UserSegmentsV2",
              ),
            },
            {
              path: "user-segments/:id",
              lazy: lazyRoute(
                () => import("./components/email-workflows/SegmentDetail"),
                "SegmentDetail",
              ),
            },
            {
              path: "user-segments/builder",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/SegmentBuilderV2"),
                "SegmentBuilderV2",
              ),
            },
            { path: "templates", lazy: lazyRoute(emailWorkflows, "TemplatesView") },
            {
              path: "templates/new",
              lazy: lazyRoute(
                () => import("./components/email-workflows/settings/EmailTemplateEditorPage"),
                "EmailTemplateEditorPage",
              ),
            },
            {
              path: "templates/:id",
              lazy: lazyRoute(
                () => import("./components/email-workflows/settings/EmailTemplateEditorPage"),
                "EmailTemplateEditorPage",
              ),
            },
            { path: "history", lazy: lazyRoute(emailWorkflows, "EmailHistory") },
            { path: "tasks", lazy: lazyRoute(emailWorkflows, "TaskQueue") },
            {
              path: "analytics",
              lazy: lazyRoute(
                () => import("./components/email-workflows/v2/AnalyticsDashboard"),
                "AnalyticsDashboard",
              ),
            },
          ],
        },
      ],
    },
  ],
);
