import {
  LucideProps,
  LucideIcon,
  ArrowDownWideNarrow,
  ArrowDownUp,
  ArrowRight,
  ArrowUpNarrowWide,
  Bell,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  Circle,
  CircleCheck,
  CircleDotDashed,
  CircleQuestionMark,
  CircleSlash2,
  CircleX,
  Crosshair,
  EllipsisVertical,
  Eye,
  EyeOff,
  File,
  FileCode,
  FilePlus,
  FileSpreadsheet,
  FileText,
  GitBranch,
  GitBranchPlus,
  Goal,
  Globe,
  Grid2X2,
  GripVertical,
  History,
  House,
  HousePlus,
  Info,
  Keyboard,
  Lasso,
  Link2,
  Link2Off,
  Lock,
  MapIcon,
  Menu,
  MousePointer2,
  MousePointerClick,
  PanelLeft,
  PanelRight,
  PencilLine,
  Pin,
  PinOff,
  Plus,
  RectangleHorizontal,
  Redo2,
  RefreshCw,
  Rocket,
  Route,
  RouteOff,
  Save,
  SaveAll,
  Settings,
  SlidersHorizontal,
  SquareDashed,
  SquareStack,
  Star,
  Sun,
  Timer,
  Trash,
  Triangle,
  TriangleAlert,
  Type,
  ToolCase,
  Undo2,
  Upload,
  User,
  Waypoints,
  X,
  Zap,
} from "lucide-react";

export const iconSizes = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export type IconSizeKey = keyof typeof iconSizes;

export type CustomIconProps = Omit<React.SVGProps<SVGSVGElement>, "size"> & {
  size?: IconSizeKey | number;
};

type IconProps = Omit<LucideProps, "size"> & {
  size?: IconSizeKey | number;
};

export const getPixels = (rawSize: IconSizeKey | number) => {
  if (typeof rawSize === "number") return rawSize;

  return iconSizes[rawSize];
};

const icon = (Icon: LucideIcon): React.FC<IconProps> => {
  return ({ size: rawSize = "md", ...props }) => {
    const pixels = getPixels(rawSize);

    return <Icon size={pixels} {...props} />;
  };
};

export const HelpIcon = icon(CircleQuestionMark);
export const RoadmapIcon = icon(MapIcon);
export const UtilitiesIcon = icon(ToolCase);
export const InfoIcon = icon(Info);
export const SuccessIcon = icon(CircleCheck);
export const WarningIcon = icon(TriangleAlert);
export const ErrorIcon = icon(CircleX);
export const UserIcon = icon(User);
export const RefreshIcon = icon(RefreshCw);
export const RedrawIcon = icon(PencilLine);
export const ArrowRightIcon = icon(ArrowRight);
export const ChevronUpIcon = icon(ChevronUp);
export const ChevronRightIcon = icon(ChevronRight);
export const ChevronDownIcon = icon(ChevronDown);
export const ChevronLeftIcon = icon(ChevronLeft);
export const ChevronsLeftIcon = icon(ChevronsLeft);
export const CloseIcon = icon(X);
export const UploadIcon = icon(Upload);
export const EarlyAccessIcon = icon(Star);
export const LabelsIcon = icon(Type);
export const CheckIcon = icon(Check);
export const KeyboardIcon = icon(Keyboard);
export const FileIcon = icon(File);
export const FileAddIcon = icon(FilePlus);
export const FileTextIcon = icon(FileText);
export const FileSpreadsheetIcon = icon(FileSpreadsheet);
export const DeleteIcon = icon(Trash);
export const ZoomToIcon = icon(Crosshair);
export const ActivateTopologyIcon = icon(Route);
export const DeactivateTopologyIcon = icon(RouteOff);
export const GlobeIcon = icon(Globe);
export const SettingsIcon = icon(Settings);
export const ControlsIcon = icon(SlidersHorizontal);
export const UpgradeIcon = icon(Rocket);
export const CircleIcon = icon(Circle);
export const MenuIcon = icon(Menu);
export const NewFromExampleIcon = icon(Sun);
export const AddIcon = icon(Plus);
export const UndoIcon = icon(Undo2);
export const RedoIcon = icon(Redo2);
export const SaveIcon = icon(Save);
export const SaveAllIcon = icon(SaveAll);
export const OutdatedSimulationIcon = icon(History);
export const RunSimulationIcon = icon(Zap);
export const TimerIcon = icon(Timer);
export const CustomerPointIcon = icon(House);
export const ImportCustomerPointsIcon = icon(HousePlus);
export const UnavailableIcon = icon(CircleSlash2);
export const MultipleAssetsIcon = icon(SquareStack);
export const PanelLeftIcon = icon(PanelLeft);
export const PanelRightIcon = icon(PanelRight);
export const MultipleValuesIcon = icon(SquareStack);
export const JunctionIcon = icon(Circle);
export const ReservoirIcon = icon(Triangle);
export const TankIcon = icon(RectangleHorizontal);
export const MouseCursorDefaultIcon = icon(MousePointer2);
export const PointerClickIcon = icon(MousePointerClick);
export const SubscribeIcon = icon(Bell);
export const Draggable = icon(GripVertical);
export const TabsIcon = icon(Grid2X2);
export const VisibilityOnIcon = icon(Eye);
export const VisibilityOffIcon = icon(EyeOff);
export const ConnectIcon = icon(Link2);
export const DisconnectIcon = icon(Link2Off);
export const HouseIcon = icon(House);
export const ConnectivityTraceIcon = icon(Waypoints);
export const OrphanNodeIcon = icon(CircleDotDashed);
export const NoIssuesIcon = icon(Goal);
export const RectangularSelectionIcon = icon(SquareDashed);
export const FreeHandSelectionIcon = icon(Lasso);
export const SortAscendingIcon = icon(ArrowUpNarrowWide);
export const SortDescendingIcon = icon(ArrowDownWideNarrow);
export const PinIcon = icon(Pin);
export const PinOffIcon = icon(PinOff);
export const MoreActionsIcon = icon(EllipsisVertical);
export const ScenarioIcon = icon(GitBranch);
export const AddScenarioIcon = icon(GitBranchPlus);
export const MainModelIcon = icon(Lock);
export const ControlsIconAlt = icon(FileCode);
export const PatternsIcon = icon(ChartColumn);

export const ReverseIcon: React.FC<IconProps> = ({
  size: rawSize = "md",
  ...props
}) => {
  const pixels = getPixels(rawSize);

  return (
    <ArrowDownUp
      size={pixels}
      {...props}
      style={{ transform: "rotate(90deg)", ...props.style }}
    />
  );
};

export { CustomUnsavedChangesIcon as UnsavedChangesIcon } from "./custom-icons/unsaved-changes-icon";
export { CustomGithubIcon as GithubIcon } from "./custom-icons/github-icon";
export { CustomPipeIcon as PipeIcon } from "./custom-icons/pipe-icon";
export { CustomPumpIcon as PumpIcon } from "./custom-icons/pump-icon";
export { CustomTypeOffIcon as TypeOffIcon } from "./custom-icons/type-off-icon";
export { CustomValveIcon as ValveIcon } from "./custom-icons/valve-icon";
export { CustomPipesCrossingIcon as PipesCrossinIcon } from "./custom-icons/pipes-crossing-icon";
export { CustomProximityCheckIcon as ProximityCheckIcon } from "./custom-icons/proximity-check-icon";
export { CustomPanelLeftActive as PanelLeftActiveIcon } from "./custom-icons/panel-left-active";
export { CustomPanelRightActive as PanelRightActiveIcon } from "./custom-icons/panel-right-active";
export { CustomPolygonalSelection as PolygonalSelectionIcon } from "./custom-icons/polygonal-selection";
export { CustomActiveTopologyEnableIcon as ActiveTopologyEnableIcon } from "./custom-icons/active-topology-enable";
export { CustomActiveTopologyDisableIcon as ActiveTopologyDisableIcon } from "./custom-icons/active-topology-disable";
export { CustomOperationalDataIcon as AdvancedSettingsIcon } from "./custom-icons/operational-data";
