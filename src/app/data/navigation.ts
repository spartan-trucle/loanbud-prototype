import {
  FileText,
  Briefcase,
  Users as UsersIcon,
  Workflow,
  User,
  Zap,
  ClipboardList,
  Building,
  Settings,
  Layers,
  Inbox,
  CheckSquare,
  Tag,
  Megaphone,
} from "lucide-react";
import type { AppSidebarSection } from "../types";

export const appSidebarSections: AppSidebarSection[] = [
  {
    items: [
      { id: "applications",         label: "Applications",         icon: FileText,  route: "/applications" },
      { id: "business-acquisition", label: "Business Acquisition", icon: Briefcase, route: "/business-acquisition" },
    ],
  },
  {
    items: [
      {
        id: "crm",
        label: "CRM",
        icon: UsersIcon,
        route: "/crm/contacts",
        children: [
          { id: "crm-contacts",   label: "Contacts",  route: "/crm/contacts",  icon: UsersIcon },
          { id: "crm-companies",  label: "Companies", route: "/crm/companies", icon: Building  },
          { id: "crm-listings",   label: "Listings",  route: "/crm/listings",  icon: Tag       },
          { id: "crm-campaigns",  label: "Campaigns", route: "/crm/campaigns", icon: Megaphone },
          { id: "crm-segments",   label: "Segments",  route: "/crm/segments",  icon: Layers    },
          { id: "crm-workflows",  label: "Workflows", route: "/crm/workflows", icon: Workflow  },
          { id: "crm-inbox",      label: "Inbox",     route: "/crm/inbox",     icon: Inbox      },
          { id: "crm-tasks",      label: "Tasks",     route: "/crm/tasks",     icon: CheckSquare },
          { id: "crm-settings",   label: "Settings",  route: "/crm/settings",  icon: Settings   },
        ],
      },
      { id: "users",           label: "Users",           icon: User,          route: "/users"          },
      { id: "automations",     label: "Automations",     icon: Zap,           route: "/automations"    },
      { id: "questionnaires",  label: "Questionnaires",  icon: ClipboardList, route: "/questionnaires" },
      { id: "configurations",  label: "Configurations",  icon: Settings,      route: "/configurations" },
    ],
  },
];
