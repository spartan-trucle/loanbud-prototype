import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { CRMLayout } from "./layouts/CRMLayout";
import { EmailWorkflowsLayout } from "./layouts/EmailWorkflowsLayout";
import { ApplicationList, BusinessAcquisitionList } from "./components/applications";
import { ContactList, ContactDetail } from "./components/crm";
import {
  FlowBuilder,
  UserSegments,
  SegmentsView,
  TemplatesView,
  EmailHistory,
  TaskQueue,
  WorkflowList,
  WorkflowBuilder,
  WorkflowBoard,
} from "./components/email-workflows";
import { SegmentDetail } from "./components/email-workflows/SegmentDetail";
import { EmailTemplateEditorPage } from "./components/email-workflows/settings/EmailTemplateEditorPage";
import { PlaceholderView } from "./components/ui/PlaceholderView";
import { VersionRoute } from "./components/ui/VersionRoute";
// V2 components
import { WorkflowBoardV2 } from "./components/email-workflows/v2/WorkflowBoardV2";
import { WorkflowBuilderV2 } from "./components/email-workflows/v2/WorkflowBuilderV2";
import { UserSegmentsV2 } from "./components/email-workflows/v2/UserSegmentsV2";
import { SegmentBuilderV2 } from "./components/email-workflows/v2/SegmentBuilderV2";
import { AnalyticsDashboard } from "./components/email-workflows/v2/AnalyticsDashboard";
import {
  Briefcase,
  User,
  Zap,
  ClipboardList,
  Sliders,
  BarChart2,
} from "lucide-react";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/applications" replace /> },
      { path: "applications", element: <ApplicationList /> },
      { path: "business-acquisition", element: <BusinessAcquisitionList /> },
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
          { path: "contacts", element: <ContactList /> },
          { path: "contacts/:id", element: <ContactDetail /> },
          { path: "companies", element: <PlaceholderView icon={Briefcase} title="Companies" /> },
          { path: "tasks", element: <TaskQueue /> },
          // Segments (moved from email-workflows)
          {
            path: "segments",
            element: (
              <VersionRoute
                v1={<UserSegments />}
                v2={<UserSegmentsV2 />}
              />
            ),
          },
          { path: "segments/:id", element: <SegmentDetail /> },
          {
            path: "segments/builder",
            element: (
              <VersionRoute
                v1={<SegmentsView />}
                v2={<SegmentBuilderV2 />}
              />
            ),
          },
          // Workflows (moved from email-workflows)
          { path: "workflows", element: <WorkflowList /> },
          {
            path: "workflows/new",
            element: (
              <VersionRoute
                v1={<WorkflowBuilder />}
                v2={<WorkflowBuilderV2 />}
              />
            ),
          },
          {
            path: "workflows/:id/edit",
            element: (
              <VersionRoute
                v1={<WorkflowBuilder />}
                v2={<WorkflowBuilderV2 />}
              />
            ),
          },
          {
            path: "workflows/:id/board",
            element: (
              <VersionRoute
                v1={<WorkflowBoard />}
                v2={<WorkflowBoardV2 />}
              />
            ),
          },
          // Inbox (communication history)
          { path: "inbox", element: <EmailHistory /> },
          // Settings (combined CRM + workflow config)
          { path: "settings", element: <TemplatesView /> },
        ],
      },

      // Email Workflows section
      {
        path: "email-workflows",
        element: <EmailWorkflowsLayout />,
        children: [
          { index: true, element: <Navigate to="/email-workflows/flows" replace /> },
          { path: "flows", element: <WorkflowList /> },
          {
            path: "flows/new",
            element: (
              <VersionRoute
                v1={<WorkflowBuilder />}
                v2={<WorkflowBuilderV2 />}
              />
            ),
          },
          {
            path: "flows/:id/edit",
            element: (
              <VersionRoute
                v1={<WorkflowBuilder />}
                v2={<WorkflowBuilderV2 />}
              />
            ),
          },
          {
            path: "flows/:id/board",
            element: (
              <VersionRoute
                v1={<WorkflowBoard />}
                v2={<WorkflowBoardV2 />}
              />
            ),
          },
          { path: "flow-builder", element: <FlowBuilder /> },
          {
            path: "user-segments",
            element: (
              <VersionRoute
                v1={<UserSegments />}
                v2={<UserSegmentsV2 />}
              />
            ),
          },
          { path: "user-segments/:id", element: <SegmentDetail /> },
          {
            path: "user-segments/builder",
            element: (
              <VersionRoute
                v1={<SegmentsView />}
                v2={<SegmentBuilderV2 />}
              />
            ),
          },
          { path: "templates", element: <TemplatesView /> },
          { path: "templates/new", element: <EmailTemplateEditorPage /> },
          { path: "templates/:id", element: <EmailTemplateEditorPage /> },
          { path: "history", element: <EmailHistory /> },
          { path: "tasks", element: <TaskQueue /> },
          // V2-only routes
          {
            path: "analytics",
            element: (
              <VersionRoute
                v1={<PlaceholderView icon={BarChart2} title="Analytics" badge="Available in V2" />}
                v2={<AnalyticsDashboard />}
              />
            ),
          },
        ],
      },
    ],
  },
  ],
  // Match the router basename to the Vite base so routes resolve both under
  // the GitHub Pages repo path and at the domain root on Vercel.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" }
);
