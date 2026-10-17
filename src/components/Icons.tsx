import {
  ArrowLeft,
  Baby,
  Bath,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Download,
  Droplets,
  FileChartColumnIncreasing,
  HeartHandshake,
  House,
  Info,
  LayoutDashboard,
  ListFilter,
  Map,
  PersonStanding,
  Search,
  Settings2,
  Users,
  UsersRound,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"

type IconName =
  | "grid"
  | "map"
  | "team"
  | "report"
  | "settings"
  | "search"
  | "calendar"
  | "download"
  | "chevron"
  | "arrow"
  | "users"
  | "briefcase"
  | "family"
  | "baby"
  | "child"
  | "couple"
  | "mother"
  | "info"
  | "filter"
  | "water"
  | "home"
  | "toilet"
  | "close"

const icons: Record<IconName, LucideIcon> = {
  grid: LayoutDashboard,
  map: Map,
  team: UsersRound,
  report: FileChartColumnIncreasing,
  settings: Settings2,
  search: Search,
  calendar: CalendarDays,
  download: Download,
  chevron: ChevronRight,
  arrow: ArrowLeft,
  users: Users,
  briefcase: BriefcaseBusiness,
  family: HeartHandshake,
  baby: Baby,
  child: PersonStanding,
  couple: HeartHandshake,
  mother: UsersRound,
  info: Info,
  filter: ListFilter,
  water: Droplets,
  home: House,
  toilet: Bath,
  close: X,
}

export function Icon({ name, ...props }: LucideProps & { name: IconName }) {
  if (name === "mother") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        aria-hidden="true"
        {...props}
      >
        <circle cx="9.5" cy="3.75" r="2.15" />
        <path d="M8.45 6.55c-1.18.72-1.94 2.04-2.06 3.52l-.58 6.35h2.42L7.6 22h2.76l.77-5.34.94 5.34h2.74l-.96-5.24c2.7-.35 4.34-1.98 4.34-4.23 0-2.48-2.09-4.2-5.2-4.45-.52-1.07-1.58-1.76-2.78-1.76-.62 0-1.22.08-1.76.23Z" />
        <path
          d="M9.55 8.35c.73 2.17 2.08 3.45 4.34 3.92"
          fill="none"
          stroke="white"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const Component = icons[name]
  return <Component strokeWidth={1.8} aria-hidden="true" {...props} />
}
