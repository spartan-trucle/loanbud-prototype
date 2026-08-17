import { useState } from "react";
import type {
  AdminEmailTemplate,
  SenderIdentity,
  SmsTemplate,
  TemplateFolder,
  VoicemailScript,
  VoicemailSettings,
} from "../types";
import { store } from "../data/store";
import { CURRENT_USER_ROLE, type TeamRole } from "../config/team";
import { getDescendantFolderIds } from "../components/email-workflows/settings/templateVisibility";

/**
 * The reusable-content domain: email/SMS templates and their folders, voicemail
 * scripts and settings, sender identities, and the category lists behind them.
 *
 * Split out of AppDataContext because these slices are self-contained — no handler
 * here reads or writes contacts, tasks, workflows or segments. AppDataProvider
 * destructures the result, so `useAppData()` keeps exactly the same shape.
 */
/** Pulls {{placeholder}} names out of a template body. */
function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{([\w.]+)\}\}/g)].map((m) => m[1]))];
}

export function useContentLibrary() {
  const [adminEmailTemplates, setAdminEmailTemplates] = useState<AdminEmailTemplate[]>(store.adminEmailTemplates.read());
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>(store.smsTemplates.read());
  const [voicemailScripts, setVoicemailScripts] = useState<VoicemailScript[]>(store.voicemailScripts.read());
  const [voicemailSettings, setVoicemailSettings] = useState<VoicemailSettings>(
    store.voicemailSettings.read()[0] ?? { providerName: "", fromPhoneNumber: "", ringlessEnabled: false, defaultGreeting: "", recordingEnabled: false },
  );
  const [senderIdentities, setSenderIdentities] = useState<SenderIdentity[]>(store.senderIdentities.read());
  const [templateFolders, setTemplateFolders] = useState<TemplateFolder[]>(store.templateFolders.read());
  const [currentUserRole, setCurrentUserRole] = useState<TeamRole>(CURRENT_USER_ROLE);
  const [smsCategories, setSmsCategories] = useState<string[]>(store.smsCategories.read());
  const [voicemailCategories, setVoicemailCategories] = useState<string[]>(store.voicemailCategories.read());

  const handleCreateAdminEmailTemplate = (t: Omit<AdminEmailTemplate, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date();
    const created: AdminEmailTemplate = {
      ...t,
      id: `etpl-${Date.now()}`,
      variables: extractVariables(`${t.subject} ${t.body}`),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...adminEmailTemplates, created];
    setAdminEmailTemplates(updated);
    store.adminEmailTemplates.write(updated);
  };

  const handleUpdateAdminEmailTemplate = (id: string, updates: Partial<Omit<AdminEmailTemplate, "id" | "createdAt">>) => {
    const now = new Date();
    const updated = adminEmailTemplates.map((t) =>
      t.id === id
        ? {
            ...t,
            ...updates,
            variables: extractVariables(`${updates.subject ?? t.subject} ${updates.body ?? t.body}`),
            updatedAt: now,
          }
        : t,
    );
    setAdminEmailTemplates(updated);
    store.adminEmailTemplates.write(updated);
  };

  const handleDeleteAdminEmailTemplate = (id: string) => {
    const updated = adminEmailTemplates.filter((t) => t.id !== id);
    setAdminEmailTemplates(updated);
    store.adminEmailTemplates.write(updated);
  };

  const persistFolders = (updated: TemplateFolder[]) => {
    setTemplateFolders(updated);
    store.templateFolders.write(updated);
  };

  const handleSetCurrentUserRole = (role: TeamRole) => setCurrentUserRole(role);

  const handleCreateFolder = (name: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created: TemplateFolder = {
      id: `fld-${Date.now()}`,
      name: trimmed,
      parentId,
      visibleToLoanOfficers: true,
      createdAt: new Date(),
    };
    persistFolders([...templateFolders, created]);
  };

  const handleRenameFolder = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persistFolders(templateFolders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
  };

  const handleMoveFolder = (id: string, newParentId: string | null) => {
    if (id === newParentId) return; // no self-parent
    if (newParentId !== null && getDescendantFolderIds(id, templateFolders).includes(newParentId)) return; // no cycle
    persistFolders(templateFolders.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)));
  };

  const handleSetFolderVisibility = (id: string, visibleToLoanOfficers: boolean) => {
    persistFolders(templateFolders.map((f) => (f.id === id ? { ...f, visibleToLoanOfficers } : f)));
  };

  const handleDeleteFolder = (id: string) => {
    const target = templateFolders.find((f) => f.id === id);
    if (!target) return;
    // Promote direct subfolders to the deleted folder's parent.
    const remaining = templateFolders
      .filter((f) => f.id !== id)
      .map((f) => (f.parentId === id ? { ...f, parentId: target.parentId } : f));
    persistFolders(remaining);
    // Move this folder's direct templates to Uncategorized (folderId null).
    const updatedTemplates = adminEmailTemplates.map((t) =>
      t.folderId === id ? { ...t, folderId: null } : t,
    );
    setAdminEmailTemplates(updatedTemplates);
    store.adminEmailTemplates.write(updatedTemplates);
  };

  const handleMoveTemplateToFolder = (templateId: string, folderId: string | null) => {
    const updated = adminEmailTemplates.map((t) => (t.id === templateId ? { ...t, folderId } : t));
    setAdminEmailTemplates(updated);
    store.adminEmailTemplates.write(updated);
  };

  const handleCreateSmsTemplate = (t: Omit<SmsTemplate, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date();
    const created: SmsTemplate = {
      ...t,
      id: `sms-${Date.now()}`,
      characterCount: t.message.length,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...smsTemplates, created];
    setSmsTemplates(updated);
    store.smsTemplates.write(updated);
  };

  const handleUpdateSmsTemplate = (id: string, updates: Partial<Omit<SmsTemplate, "id" | "createdAt">>) => {
    const now = new Date();
    const updated = smsTemplates.map((t) =>
      t.id === id
        ? { ...t, ...updates, characterCount: (updates.message ?? t.message).length, updatedAt: now }
        : t,
    );
    setSmsTemplates(updated);
    store.smsTemplates.write(updated);
  };

  const handleDeleteSmsTemplate = (id: string) => {
    const updated = smsTemplates.filter((t) => t.id !== id);
    setSmsTemplates(updated);
    store.smsTemplates.write(updated);
  };

  const handleCreateVoicemailScript = (s: Omit<VoicemailScript, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date();
    const created: VoicemailScript = { ...s, id: `vm-${Date.now()}`, createdAt: now, updatedAt: now };
    const updated = [...voicemailScripts, created];
    setVoicemailScripts(updated);
    store.voicemailScripts.write(updated);
  };

  const handleUpdateVoicemailScript = (id: string, updates: Partial<Omit<VoicemailScript, "id" | "createdAt">>) => {
    const now = new Date();
    const updated = voicemailScripts.map((s) =>
      s.id === id ? { ...s, ...updates, updatedAt: now } : s,
    );
    setVoicemailScripts(updated);
    store.voicemailScripts.write(updated);
  };

  const handleDeleteVoicemailScript = (id: string) => {
    const updated = voicemailScripts.filter((s) => s.id !== id);
    setVoicemailScripts(updated);
    store.voicemailScripts.write(updated);
  };

  const handleUpdateVoicemailSettings = (updates: Partial<VoicemailSettings>) => {
    const merged = { ...voicemailSettings, ...updates };
    setVoicemailSettings(merged);
    store.voicemailSettings.write([merged]);
  };

  const handleCreateSenderIdentity = (s: Omit<SenderIdentity, "id" | "createdAt">) => {
    const created: SenderIdentity = { ...s, id: `sid-${Date.now()}`, createdAt: new Date() };
    const updated = s.isDefault
      ? [...senderIdentities.map((i) => ({ ...i, isDefault: false })), created]
      : [...senderIdentities, created];
    setSenderIdentities(updated);
    store.senderIdentities.write(updated);
  };

  const handleUpdateSenderIdentity = (id: string, updates: Partial<Omit<SenderIdentity, "id" | "createdAt">>) => {
    const updated = senderIdentities.map((i) => {
      if (i.id === id) return { ...i, ...updates };
      if (updates.isDefault) return { ...i, isDefault: false };
      return i;
    });
    setSenderIdentities(updated);
    store.senderIdentities.write(updated);
  };

  const handleDeleteSenderIdentity = (id: string) => {
    const updated = senderIdentities.filter((i) => i.id !== id);
    setSenderIdentities(updated);
    store.senderIdentities.write(updated);
  };

  const handleSetDefaultSenderIdentity = (id: string) => {
    const updated = senderIdentities.map((i) => ({ ...i, isDefault: i.id === id }));
    setSenderIdentities(updated);
    store.senderIdentities.write(updated);
  };

  const handleAddSmsCategory = (name: string) => {
    if (smsCategories.includes(name)) return;
    const updated = [...smsCategories, name];
    setSmsCategories(updated);
    store.smsCategories.write(updated);
  };

  const handleDeleteSmsCategory = (name: string) => {
    const updated = smsCategories.filter((c) => c !== name);
    setSmsCategories(updated);
    store.smsCategories.write(updated);
  };

  const handleRenameSmsCategory = (oldName: string, newName: string) => {
    if (!newName || smsCategories.includes(newName)) return;
    const updated = smsCategories.map((c) => (c === oldName ? newName : c));
    setSmsCategories(updated);
    store.smsCategories.write(updated);
  };

  const handleAddVoicemailCategory = (name: string) => {
    if (voicemailCategories.includes(name)) return;
    const updated = [...voicemailCategories, name];
    setVoicemailCategories(updated);
    store.voicemailCategories.write(updated);
  };

  const handleDeleteVoicemailCategory = (name: string) => {
    const updated = voicemailCategories.filter((c) => c !== name);
    setVoicemailCategories(updated);
    store.voicemailCategories.write(updated);
  };

  const handleRenameVoicemailCategory = (oldName: string, newName: string) => {
    if (!newName || voicemailCategories.includes(newName)) return;
    const updated = voicemailCategories.map((c) => (c === oldName ? newName : c));
    setVoicemailCategories(updated);
    store.voicemailCategories.write(updated);
  };

  return {
    adminEmailTemplates,
    smsTemplates,
    voicemailScripts,
    voicemailSettings,
    senderIdentities,
    templateFolders,
    currentUserRole,
    smsCategories,
    voicemailCategories,
    handleCreateAdminEmailTemplate,
    handleUpdateAdminEmailTemplate,
    handleDeleteAdminEmailTemplate,
    handleSetCurrentUserRole,
    handleCreateFolder,
    handleRenameFolder,
    handleMoveFolder,
    handleSetFolderVisibility,
    handleDeleteFolder,
    handleMoveTemplateToFolder,
    handleCreateSmsTemplate,
    handleUpdateSmsTemplate,
    handleDeleteSmsTemplate,
    handleCreateVoicemailScript,
    handleUpdateVoicemailScript,
    handleDeleteVoicemailScript,
    handleUpdateVoicemailSettings,
    handleCreateSenderIdentity,
    handleUpdateSenderIdentity,
    handleDeleteSenderIdentity,
    handleSetDefaultSenderIdentity,
    handleAddSmsCategory,
    handleDeleteSmsCategory,
    handleRenameSmsCategory,
    handleAddVoicemailCategory,
    handleDeleteVoicemailCategory,
    handleRenameVoicemailCategory,
  };
}
