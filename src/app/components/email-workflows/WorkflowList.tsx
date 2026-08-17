import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, LayoutList, Search } from "lucide-react";
import { Button } from "../ui/button";
import { useAppData } from "../../contexts/AppDataContext";

const ACTION_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  "call-reminder": "Call",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function WorkflowList() {
  const navigate = useNavigate();
  const { workflows, workflowEnrollments, emailHistory } = useAppData();
  const [search, setSearch] = useState("");

  const handleRowClick = (id: string) => {
    navigate(`/email-workflows/flows/${id}/board`);
  };

  const filtered = workflows.filter((wf) =>
    wf.name.toLowerCase().includes(search.toLowerCase()) ||
    wf.segmentName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold text-foreground mb-1">Flows</h1>
          <p className="text-sm text-muted-foreground">Manage and track contact workflows</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search flows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: "38px" }}
            />
          </div>
          <Button onClick={() => navigate("/email-workflows/flows/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Flow
          </Button>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <LayoutList className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium text-foreground">No Flows Yet</p>
            <p className="text-sm">Create your first workflow to start nurturing contacts.</p>
            <Button className="mt-2" onClick={() => navigate("/email-workflows/flows/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Flow
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Name", "Segment", "Status", "Replies", "Steps", "Activated"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filtered.map((wf) => (
                  <tr
                    key={wf.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(wf.id)}
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{wf.name}</div>
                      {wf.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{wf.segmentName}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          wf.status === "active" ? "bg-green-500"
                          : wf.status === "paused" ? "bg-amber-400"
                          : "bg-gray-400"
                        }`} />
                        {wf.status === "active" ? "Active" : wf.status === "draft" ? "Draft" : "Paused"}
                      </span>
                    </td>
                    {(() => {
                      const unread = emailHistory.filter(
                        (e) => e.direction === "inbound" && !e.read &&
                          workflowEnrollments.some((en) => en.workflowId === wf.id && en.contactId === e.contactId),
                      ).length;
                      return (
                        <td className="px-5 py-4">
                          {unread > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                              {unread} new
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })()}
                    <td className="px-5 py-4 text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {wf.steps.slice(0, 3).map((s) => (
                          <span key={s.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            Day {s.dayOffset} · {ACTION_TYPE_LABELS[s.actionType] ?? s.actionType}
                          </span>
                        ))}
                        {wf.steps.length > 3 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground font-medium">
                            +{wf.steps.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {wf.status === "active" ? formatDate(wf.createdAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
