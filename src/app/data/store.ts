import type { Contact, EmailRecord, Task, Segment, TaskItem, Application, BusinessAcquisitionRecord, Workflow, WorkflowEnrollment, ContactActivityRecord, AdminEmailTemplate, SmsTemplate, VoicemailScript, VoicemailSettings, SenderIdentity, Notification, NotificationPreferences, LoGroup, TemplateFolder, Campaign, CustomFieldDefinition, Company, ListingRecord } from "../types";
import contactsJson from "./contacts.json";
import segmentsJson from "./segments.json";
import taskItemsJson from "./taskItems.json";
import emailHistoryJson from "./emailHistory.json";
import tasksJson from "./tasks.json";
import applicationsJson from "./applications.json";
import businessAcquisitionsJson from "./businessAcquisitions.json";
import workflowsJson from "./workflows.json";
import workflowEnrollmentsJson from "./workflowEnrollments.json";
import contactActivityJson from "./contactActivity.json";
import adminEmailTemplatesJson from "./adminEmailTemplates.json";
import templateFoldersJson from "./templateFolders.json";
import smsTemplatesJson from "./smsTemplates.json";
import voicemailScriptsJson from "./voicemailScripts.json";
import voicemailSettingsJson from "./voicemailSettings.json";
import senderIdentitiesJson from "./senderIdentities.json";
import notificationsJson from "./notifications.json";
import loGroupsJson from "./loGroups.json";
import campaignsJson from "./campaigns.json";
import customFieldDefinitionsJson from "./customFieldDefinitions.json";
import companiesJson from "./companies.json";
import listingsJson from "./listings.json";

const KEYS = {
  // v6: traffic-source enum reduced to five; contacts on retired branches remapped
  contacts: "loanbudcrm:v6:contacts",
  segments: "loanbudcrm:v2:segments",
  campaigns: "loanbudcrm:v2:campaigns",
  companies: "loanbudcrm:v1:companies",
  listings: "loanbudcrm:v1:listings",
  customFieldDefinitions: "loanbudcrm:v1:customFieldDefinitions",
  taskItems: "loanbudcrm:taskItems",
  emailHistory: "loanbudcrm:v3:emailHistory",
  tasks: "loanbudcrm:tasks",
  applications: "loanbudcrm:applications",
  businessAcquisitions: "loanbudcrm:businessAcquisitions",
  workflows: "loanbudcrm:v5:workflows",
  workflowEnrollments: "loanbudcrm:v5:workflowEnrollments",
  contactActivity: "loanbudcrm:v2:contactActivity",
  adminEmailTemplates: "loanbudcrm:v6:adminEmailTemplates",
  templateFolders: "loanbudcrm:v1:templateFolders",
  smsTemplates: "loanbudcrm:v2:smsTemplates",
  voicemailScripts: "loanbudcrm:v2:voicemailScripts",
  voicemailSettings: "loanbudcrm:v2:voicemailSettings",
  senderIdentities: "loanbudcrm:v2:senderIdentities",
  notifications: "loanbudcrm:notifications",
  loGroups: "loanbudcrm:loGroups",
  notificationPrefs: "loanbudcrm:v2:notificationPrefs",
  smsCategories: "loanbudcrm:v2:smsCategories",
  voicemailCategories: "loanbudcrm:v2:voicemailCategories",
} as const;

function readObject<T extends object>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function writeObject<T extends object>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function readStringArray(key: string, fallback: string[]): string[] {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as string[]) : fallback;
}

function writeStringArray(key: string, data: string[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * JSON — both the seed files and localStorage — carries dates as ISO strings.
 * Rehydrate the named fields into real `Date`s so consumers can call date methods.
 *
 * The record view is deliberate: entity types are interfaces without index
 * signatures, so a generic constrained to `Record<string, unknown>` would reject
 * every one of them and a generic index write would not type-check either.
 */
function reviveDates<T>(items: readonly unknown[], dateFields: readonly string[]): T[] {
  return items.map((item) => {
    const result = { ...(item as Record<string, unknown>) };
    for (const field of dateFields) {
      const value = result[field];
      if (typeof value === "string") {
        result[field] = new Date(value);
      }
    }
    return result as T;
  });
}

function read<T>(
  key: string,
  fallback: readonly unknown[],
  dateFields: readonly string[],
): T[] {
  const raw = localStorage.getItem(key);
  const parsed: readonly unknown[] = raw ? (JSON.parse(raw) as unknown[]) : fallback;
  return reviveDates<T>(parsed, dateFields);
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const store = {
  contacts: {
    read: () =>
      read<Contact>(
        KEYS.contacts,
        contactsJson,
        ["createAt"],
      ),
    write: (data: Contact[]) => write(KEYS.contacts, data),
  },
  segments: {
    read: () =>
      read<Segment>(
        KEYS.segments,
        segmentsJson,
        ["lastUpdatedAt", "createdAt"],
      ),
    write: (data: Segment[]) => write(KEYS.segments, data),
  },
  campaigns: {
    read: () =>
      read<Campaign>(
        KEYS.campaigns,
        campaignsJson,
        ["startDate", "endDate", "createdAt"],
      ),
    write: (data: Campaign[]) => write(KEYS.campaigns, data),
  },
  companies: {
    read: () =>
      read<Company>(
        KEYS.companies,
        companiesJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: Company[]) => write(KEYS.companies, data),
  },
  listings: {
    read: () =>
      read<ListingRecord>(
        KEYS.listings,
        listingsJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: ListingRecord[]) => write(KEYS.listings, data),
  },
  customFieldDefinitions: {
    read: () =>
      read<CustomFieldDefinition>(
        KEYS.customFieldDefinitions,
        customFieldDefinitionsJson,
        ["createdAt"],
      ),
    write: (data: CustomFieldDefinition[]) =>
      write(KEYS.customFieldDefinitions, data),
  },
  taskItems: {
    read: () =>
      read<TaskItem>(
        KEYS.taskItems,
        taskItemsJson,
        ["dueDate", "completedAt"],
      ),
    write: (data: TaskItem[]) => write(KEYS.taskItems, data),
  },
  emailHistory: {
    read: () =>
      read<EmailRecord>(
        KEYS.emailHistory,
        emailHistoryJson,
        ["sentAt"],
      ),
    write: (data: EmailRecord[]) => write(KEYS.emailHistory, data),
  },
  tasks: {
    read: () =>
      read<Task>(
        KEYS.tasks,
        tasksJson,
        ["scheduledFor", "completedAt"],
      ),
    write: (data: Task[]) => write(KEYS.tasks, data),
  },
  applications: {
    read: () =>
      read<Application>(
        KEYS.applications,
        applicationsJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: Application[]) => write(KEYS.applications, data),
  },
  businessAcquisitions: {
    read: () =>
      read<BusinessAcquisitionRecord>(
        KEYS.businessAcquisitions,
        businessAcquisitionsJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: BusinessAcquisitionRecord[]) =>
      write(KEYS.businessAcquisitions, data),
  },
  workflows: {
    read: () =>
      read<Workflow>(
        KEYS.workflows,
        workflowsJson,
        ["createdAt"],
      ),
    write: (data: Workflow[]) => write(KEYS.workflows, data),
  },
  workflowEnrollments: {
    read: () => {
      const enrollments = read<WorkflowEnrollment>(
        KEYS.workflowEnrollments,
        workflowEnrollmentsJson,
        ["startDate", "pausedUntil"],
      );
      return enrollments.map((e) => ({
        ...e,
        customSteps: e.customSteps?.map((cs) => ({ ...cs, createdAt: new Date(cs.createdAt as unknown as string) })),
      }));
    },
    write: (data: WorkflowEnrollment[]) => write(KEYS.workflowEnrollments, data),
  },
  contactActivity: {
    read: () => read<ContactActivityRecord>(KEYS.contactActivity, contactActivityJson, ["timestamp"]),
    write: (data: ContactActivityRecord[]) => write(KEYS.contactActivity, data),
  },
  adminEmailTemplates: {
    read: () =>
      read<AdminEmailTemplate>(
        KEYS.adminEmailTemplates,
        adminEmailTemplatesJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: AdminEmailTemplate[]) => write(KEYS.adminEmailTemplates, data),
  },
  templateFolders: {
    read: () =>
      read<TemplateFolder>(
        KEYS.templateFolders,
        templateFoldersJson,
        ["createdAt"],
      ),
    write: (data: TemplateFolder[]) => write(KEYS.templateFolders, data),
  },
  smsTemplates: {
    read: () =>
      read<SmsTemplate>(
        KEYS.smsTemplates,
        smsTemplatesJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: SmsTemplate[]) => write(KEYS.smsTemplates, data),
  },
  voicemailScripts: {
    read: () =>
      read<VoicemailScript>(
        KEYS.voicemailScripts,
        voicemailScriptsJson,
        ["createdAt", "updatedAt"],
      ),
    write: (data: VoicemailScript[]) => write(KEYS.voicemailScripts, data),
  },
  voicemailSettings: {
    read: () =>
      read<VoicemailSettings>(
        KEYS.voicemailSettings,
        voicemailSettingsJson,
        [],
      ),
    write: (data: VoicemailSettings[]) => write(KEYS.voicemailSettings, data),
  },
  senderIdentities: {
    read: () =>
      read<SenderIdentity>(
        KEYS.senderIdentities,
        senderIdentitiesJson,
        ["createdAt"],
      ),
    write: (data: SenderIdentity[]) => write(KEYS.senderIdentities, data),
  },
  notifications: {
    read: () =>
      read<Notification>(
        KEYS.notifications,
        notificationsJson,
        ["createdAt"],
      ),
    write: (data: Notification[]) => write(KEYS.notifications, data),
  },
  loGroups: {
    read: () =>
      read<LoGroup>(
        KEYS.loGroups,
        loGroupsJson,
        ["createdAt"],
      ),
    write: (data: LoGroup[]) => write(KEYS.loGroups, data),
  },
  notificationPrefs: {
    read: (): NotificationPreferences => readObject<NotificationPreferences>(
      KEYS.notificationPrefs,
      {
        task_due: true,
        task_overdue: true,
        workflow_update: true,
        application_update: true,
        enrollment_completed: true,
        enrollment_paused: true,
        step_bounced: true,
        workflow_completed_all: true,
        inbound_reply: true,
        segment_membership_changed: true,
      },
    ),
    write: (data: NotificationPreferences) => writeObject(KEYS.notificationPrefs, data),
  },
  smsCategories: {
    read: () => readStringArray(KEYS.smsCategories, ["Follow-up", "Reminder", "Appointment", "Alert", "Custom"]),
    write: (data: string[]) => writeStringArray(KEYS.smsCategories, data),
  },
  voicemailCategories: {
    read: () => readStringArray(KEYS.voicemailCategories, ["Initial Outreach", "Follow-up", "Re-engagement", "Custom"]),
    write: (data: string[]) => writeStringArray(KEYS.voicemailCategories, data),
  },
};
