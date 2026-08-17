---
name: LoanBudCRM TypeScript types reference
description: Map of src/app/types/index.ts — what lives where, and the types worth knowing before you edit — updated Aug 2026
type: project
---

**Source of truth:** `src/app/types/index.ts` (single file, ~760 lines). This note is a
map, not a copy — read the file for exact shapes. Earlier versions of this doc
transcribed the interfaces and drifted out of date; don't reintroduce that.

`src/app/components/email-workflows/campaign/types.ts` no longer exists — everything
is in the one types file.

## What's in there

**Navigation** — `MainSection`, `CRMView`, `EmailWorkflowView`, `View`,
`AppSidebarSection` / `AppSidebarItem` / `AppSidebarSubItem`, `IconNavItem`,
`CRMSubItem`, `EmailWorkflowSubItem`

**CRM core** — `Contact`, `ContactStatus`, `NewContactInput`, `ContactImportSource`,
`Company`, `Listing`, `ListingRecord`, `ListingStatus`, `ChannelOptOut`,
`ContactActivityRecord`

**Attribution & campaigns** — `TrafficSourceId`, `Campaign`, `CampaignStatus`,
`LeadFormPayload`, `LeadIngestResult`, plus the legacy `AttributionNode` /
`AttributionNodeKind`

**Custom fields** — `CustomFieldDefinition`, `CustomFieldType`

**Tasks & workflows** — `Task`, `TaskItem`, `Workflow`, `WorkflowStep`,
`WorkflowEnrollment`, `WorkflowStepProgress`, `CustomWorkflowStep`, `OutcomeRule`,
`OutcomeAction`, `OutcomeFollowup`, `LoGroup`

**Segments & filters** — `Segment`, `SavedSegment`, `FilterRule`, `FilterGroup`,
`FilterRuleV2`, `FilterGroupV2`, `FilterFieldV2`, `FilterOperatorV2`

**Content library** — `AdminEmailTemplate`, `TemplateFolder`, `SmsTemplate`,
`SmsTemplateCategory`, `VoicemailScript`, `VoicemailScriptType`, `VoicemailSettings`,
`VoicemailCategory`, `SenderIdentity`, `SenderIdentityType`, `UnlayerDesign`

**Other** — `EmailRecord`, `Notification`, `NotificationPreferences`, `Application`,
`ApplicationStage`, `LoanPurpose`, `BusinessAcquisitionRecord`,
`BusinessAcquisitionStage`, `AcquisitionType`

## Worth knowing before you edit

**`TrafficSourceId` is a closed enum on purpose.** It is the ten HubSpot contact
traffic sources, owned by code and deliberately not editable in Settings. What
marketing controls is the **campaign**, not the source list. Adding a member here is
a product decision, not a config change.

**`Contact` carries three parallel source fields** — don't collapse them:
- `attributionSource` (via `leadSource`) — which *system* created the record; also
  drives ownership/permission checks in the real backend, so it is never user-editable
- `originalTrafficSource` + `sourceDetail1/2` — where the lead *actually* came from
- `campaignId` — the campaign object it belongs to

`resolveAttribution()` and `resolveCampaignId()` fall back to the legacy
`attributionNodeId` when the flat fields are absent, which is why the seed data was
never rewritten.

**`Contact.customFields`** is `Record<string, string>` keyed by
`CustomFieldDefinition.key`. Definitions decide rendering and visibility; the contact
only stores answers. Unknown keys arriving from a form become **hidden**
auto-discovered definitions.

**`SegmentV2` is now an alias of `Segment`.** `segmentType` and `snapshotContactIds`
moved onto `Segment` itself when the V1/V2 split was removed. Prefer `Segment`.

**`Listing` vs `ListingRecord`** — `Listing` is the small shape embedded in
`Contact.listings`; `ListingRecord` is the standalone entity behind `/crm/listings`.
