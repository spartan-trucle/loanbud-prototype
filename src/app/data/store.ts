import type { Contact, EmailRecord, Task, Segment, TaskItem, Application, BusinessAcquisitionRecord, Workflow, WorkflowEnrollment, ContactActivityRecord, AdminEmailTemplate, SmsTemplate, VoicemailScript, VoicemailSettings, SenderIdentity, Notification, NotificationPreferences, LoGroup, TemplateFolder } from "../types";
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

const KEYS = {
  // v5: RFC-009 seed — attributionNodeId classification on every contact (lead source pyramid)
  contacts: "loanbudcrm:v6:contacts",
  segments: "loanbudcrm:v2:segments",
  taskItems: "loanbudcrm:taskItems",
  emailHistory: "loanbudcrm:v3:emailHistory",
  tasks: "loanbudcrm:tasks",
  applications: "loanbudcrm:applications",
  businessAcquisitions: "loanbudcrm:businessAcquisitions",
  workflows: "loanbudcrm:v6:workflows",
  workflowEnrollments: "loanbudcrm:v6:workflowEnrollments",
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

function reviveDates<T extends Record<string, unknown>>(
  items: T[],
  dateFields: string[],
): T[] {
  return items.map((item) => {
    const result = { ...item };
    for (const field of dateFields) {
      const val = result[field];
      if (typeof val === "string") {
        result[field] = new Date(val);
      }
    }
    return result;
  });
}

function read<T extends Record<string, unknown>>(
  key: string,
  fallback: T[],
  dateFields: string[],
): T[] {
  const raw = localStorage.getItem(key);
  const parsed: T[] = raw ? (JSON.parse(raw) as T[]) : fallback;
  return reviveDates(parsed, dateFields);
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const store = {
  contacts: {
    read: () =>
      read<Contact>(
        KEYS.contacts,
        contactsJson as Contact[],
        ["createAt"],
      ),
    write: (data: Contact[]) => write(KEYS.contacts, data),
  },
  segments: {
    read: () =>
      read<Segment>(
        KEYS.segments,
        segmentsJson as Segment[],
        ["lastUpdatedAt", "createdAt"],
      ),
    write: (data: Segment[]) => write(KEYS.segments, data),
  },
  taskItems: {
    read: () =>
      read<TaskItem>(
        KEYS.taskItems,
        taskItemsJson as TaskItem[],
        ["dueDate", "completedAt"],
      ),
    write: (data: TaskItem[]) => write(KEYS.taskItems, data),
  },
  emailHistory: {
    read: () =>
      read<EmailRecord>(
        KEYS.emailHistory,
        emailHistoryJson as EmailRecord[],
        ["sentAt"],
      ),
    write: (data: EmailRecord[]) => write(KEYS.emailHistory, data),
  },
  tasks: {
    read: () =>
      read<Task>(
        KEYS.tasks,
        tasksJson as Task[],
        ["scheduledFor", "completedAt"],
      ),
    write: (data: Task[]) => write(KEYS.tasks, data),
  },
  applications: {
    read: () =>
      read<Application>(
        KEYS.applications,
        applicationsJson as Application[],
        ["createdAt", "updatedAt"],
      ),
    write: (data: Application[]) => write(KEYS.applications, data),
  },
  businessAcquisitions: {
    read: () =>
      read<BusinessAcquisitionRecord>(
        KEYS.businessAcquisitions,
        businessAcquisitionsJson as BusinessAcquisitionRecord[],
        ["createdAt", "updatedAt"],
      ),
    write: (data: BusinessAcquisitionRecord[]) =>
      write(KEYS.businessAcquisitions, data),
  },
  workflows: {
    read: () =>
      read<Workflow>(
        KEYS.workflows,
        workflowsJson as unknown as Workflow[],
        ["createdAt"],
      ),
    write: (data: Workflow[]) => write(KEYS.workflows, data),
  },
  workflowEnrollments: {
    read: () => {
      const enrollments = read<WorkflowEnrollment>(
        KEYS.workflowEnrollments,
        workflowEnrollmentsJson as unknown as WorkflowEnrollment[],
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
    read: () => read<ContactActivityRecord>(KEYS.contactActivity, contactActivityJson as ContactActivityRecord[], ["timestamp"]),
    write: (data: ContactActivityRecord[]) => write(KEYS.contactActivity, data),
  },
  adminEmailTemplates: {
    read: () =>
      read<AdminEmailTemplate>(
        KEYS.adminEmailTemplates,
        adminEmailTemplatesJson as AdminEmailTemplate[],
        ["createdAt", "updatedAt"],
      ),
    write: (data: AdminEmailTemplate[]) => write(KEYS.adminEmailTemplates, data),
  },
  templateFolders: {
    read: () =>
      read<TemplateFolder>(
        KEYS.templateFolders,
        templateFoldersJson as TemplateFolder[],
        ["createdAt"],
      ),
    write: (data: TemplateFolder[]) => write(KEYS.templateFolders, data),
  },
  smsTemplates: {
    read: () =>
      read<SmsTemplate>(
        KEYS.smsTemplates,
        smsTemplatesJson as SmsTemplate[],
        ["createdAt", "updatedAt"],
      ),
    write: (data: SmsTemplate[]) => write(KEYS.smsTemplates, data),
  },
  voicemailScripts: {
    read: () =>
      read<VoicemailScript>(
        KEYS.voicemailScripts,
        voicemailScriptsJson as VoicemailScript[],
        ["createdAt", "updatedAt"],
      ),
    write: (data: VoicemailScript[]) => write(KEYS.voicemailScripts, data),
  },
  voicemailSettings: {
    read: () =>
      read<VoicemailSettings>(
        KEYS.voicemailSettings,
        voicemailSettingsJson as VoicemailSettings[],
        [],
      ),
    write: (data: VoicemailSettings[]) => write(KEYS.voicemailSettings, data),
  },
  senderIdentities: {
    read: () =>
      read<SenderIdentity>(
        KEYS.senderIdentities,
        senderIdentitiesJson as SenderIdentity[],
        ["createdAt"],
      ),
    write: (data: SenderIdentity[]) => write(KEYS.senderIdentities, data),
  },
  notifications: {
    read: () =>
      read<Notification>(
        KEYS.notifications,
        notificationsJson as Notification[],
        ["createdAt"],
      ),
    write: (data: Notification[]) => write(KEYS.notifications, data),
  },
  loGroups: {
    read: () =>
      read<LoGroup>(
        KEYS.loGroups,
        loGroupsJson as unknown as LoGroup[],
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
