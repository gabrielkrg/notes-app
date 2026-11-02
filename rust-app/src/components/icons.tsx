/**
 * App icon set: Hugeicons (free, stroke) behind the names the app already uses.
 * Each export renders <HugeiconsIcon>, so sizing classes and props pass through.
 */
import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  Attachment01Icon,
  BookOpen01Icon,
  Bookmark02Icon,
  Cancel01Icon,
  CodeIcon,
  ComputerIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  File02Icon,
  FileEditIcon,
  FloppyDiskIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderMinusIcon,
  FolderOpenIcon,
  Globe02Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  ChartRelationshipIcon,
  HighlighterIcon,
  KeyboardIcon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  LinkSquare02Icon,
  Maximize02Icon,
  Minimize02Icon,
  MinusSignIcon,
  Moon02Icon,
  MoreHorizontalIcon as MoreHorizontalSvg,
  PaintBoardIcon,
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  RefreshIcon,
  Search01Icon,
  Settings01Icon,
  SidebarLeftIcon,
  SlidersHorizontalIcon,
  SourceCodeSquareIcon,
  StickyNote02Icon,
  StopIcon,
  Sun03Icon,
  TextBoldIcon,
  TextItalicIcon,
  Tick02Icon,
  MinusSignSquareIcon,
  VolumeHighIcon,
} from '@hugeicons/core-free-icons'

export type IconProps = Omit<HugeiconsIconProps, 'icon'>

function icon(svg: IconSvgElement, name: string) {
  const Icon = (props: IconProps) => <HugeiconsIcon icon={svg} strokeWidth={1.75} {...props} />
  Icon.displayName = name
  return Icon
}

export type AppIcon = ReturnType<typeof icon>

export const ArrowLeftRight = icon(ArrowLeftRightIcon, 'ArrowLeftRight')
export const ArrowRight = icon(ArrowRight02Icon, 'ArrowRight')
export const Bold = icon(TextBoldIcon, 'Bold')
export const BookOpen = icon(BookOpen01Icon, 'BookOpen')
export const Bookmark = icon(Bookmark02Icon, 'Bookmark')
export const Check = icon(Tick02Icon, 'Check')
export const CheckIcon = icon(Tick02Icon, 'CheckIcon')
export const ChevronDown = icon(ArrowDown01Icon, 'ChevronDown')
export const ChevronLeft = icon(ArrowLeft01Icon, 'ChevronLeft')
export const ChevronRight = icon(ArrowRight01Icon, 'ChevronRight')
export const ChevronRightIcon = icon(ArrowRight01Icon, 'ChevronRightIcon')
export const ChevronUp = icon(ArrowUp01Icon, 'ChevronUp')
export const Code = icon(CodeIcon, 'Code')
export const Copy = icon(Copy01Icon, 'Copy')
export const CornerDownLeft = icon(ArrowTurnBackwardIcon, 'CornerDownLeft')
export const FilePen = icon(FileEditIcon, 'FilePen')
export const FileText = icon(File02Icon, 'FileText')
export const Folder = icon(Folder01Icon, 'Folder')
export const FolderMinus = icon(FolderMinusIcon, 'FolderMinus')
export const FolderOpen = icon(FolderOpenIcon, 'FolderOpen')
export const FolderPlus = icon(FolderAddIcon, 'FolderPlus')
export const Globe = icon(Globe02Icon, 'Globe')
export const Heading1 = icon(Heading01Icon, 'Heading1')
export const Heading2 = icon(Heading02Icon, 'Heading2')
export const Heading3 = icon(Heading03Icon, 'Heading3')
export const Highlighter = icon(HighlighterIcon, 'Highlighter')
export const Italic = icon(TextItalicIcon, 'Italic')
export const Keyboard = icon(KeyboardIcon, 'Keyboard')
export const LayoutDashboard = icon(DashboardSquare01Icon, 'LayoutDashboard')
export const Link = icon(Link01Icon, 'Link')
export const List = icon(LeftToRightListBulletIcon, 'List')
export const ListOrdered = icon(LeftToRightListNumberIcon, 'ListOrdered')
export const Maximize2 = icon(Maximize02Icon, 'Maximize2')
export const Minimize2 = icon(Minimize02Icon, 'Minimize2')
export const Minus = icon(MinusSignIcon, 'Minus')
export const Monitor = icon(ComputerIcon, 'Monitor')
export const Moon = icon(Moon02Icon, 'Moon')
export const MoreHorizontalIcon = icon(MoreHorizontalSvg, 'MoreHorizontalIcon')
export const Network = icon(ChartRelationshipIcon, 'Network')
export const Palette = icon(PaintBoardIcon, 'Palette')
export const PanelLeftIcon = icon(SidebarLeftIcon, 'PanelLeftIcon')
export const Paperclip = icon(Attachment01Icon, 'Paperclip')
export const Pause = icon(PauseIcon, 'Pause')
export const Pencil = icon(PencilEdit02Icon, 'Pencil')
export const Play = icon(PlayIcon, 'Play')
export const RefreshCw = icon(RefreshIcon, 'RefreshCw')
export const Save = icon(FloppyDiskIcon, 'Save')
export const Search = icon(Search01Icon, 'Search')
export const SearchIcon = icon(Search01Icon, 'SearchIcon')
export const Settings = icon(Settings01Icon, 'Settings')
export const SlidersHorizontal = icon(SlidersHorizontalIcon, 'SlidersHorizontal')
export const Square = icon(StopIcon, 'Square')
export const SquareArrowOutUpRight = icon(LinkSquare02Icon, 'SquareArrowOutUpRight')
export const SquareCode = icon(SourceCodeSquareIcon, 'SquareCode')
export const StickyNote = icon(StickyNote02Icon, 'StickyNote')
export const Sun = icon(Sun03Icon, 'Sun')
export const TextQuote = icon(LeftToRightBlockQuoteIcon, 'TextQuote')
export const Trash2 = icon(Delete02Icon, 'Trash2')
export const CollapseAll = icon(MinusSignSquareIcon, 'CollapseAll')
export const Volume2 = icon(VolumeHighIcon, 'Volume2')
export const X = icon(Cancel01Icon, 'X')
export const XIcon = icon(Cancel01Icon, 'XIcon')
