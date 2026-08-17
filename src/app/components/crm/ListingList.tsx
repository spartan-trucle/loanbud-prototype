import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { ListingStatus } from "@/app/types";

const STATUSES: ListingStatus[] = [
  "New",
  "Draft",
  "Submitted",
  "On Hold",
  "Declined",
];

const STATUS_TONE: Record<ListingStatus, string> = {
  New: "bg-sky-50 text-sky-700 border-sky-200",
  Draft: "bg-muted text-muted-foreground border-border",
  Submitted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  Declined: "bg-rose-50 text-rose-700 border-rose-200",
};

const TH_CLASS = "px-6 py-4 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function ListingList() {
  const { listings } = useAppData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const visible = useMemo(() => {
    let result = listings;
    if (status !== "ALL") {
      result = result.filter((l) => l.status === status);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          l.industry.toLowerCase().includes(term) ||
          l.location.toLowerCase().includes(term),
      );
    }
    return result;
  }, [listings, search, status]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center mb-4">
          <h2
            className="text-3xl mr-6"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Listings
          </h2>
          <p className="text-muted-foreground mt-1">{visible.length} listings</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: "38px" }}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Status: All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className={TH_CLASS} style={TH_STYLE}>Listing Name</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Asking Price</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Status</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Industry</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Location</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((listing) => (
                    <tr key={listing.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                        {listing.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {currency.format(listing.askingPrice)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${STATUS_TONE[listing.status]}`}
                        >
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{listing.industry}</td>
                      <td className="px-6 py-4 text-sm">{listing.location}</td>
                      <td className="px-6 py-4 text-sm">
                        {listing.updatedAt?.toLocaleDateString() ??
                          listing.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visible.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No listings match your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
