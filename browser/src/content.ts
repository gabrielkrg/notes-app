import rawPages from 'virtual:notes-pages'
import { buildContent } from './content-core.ts'

export const bundledContent = buildContent(rawPages)
export const pages = bundledContent.pages
export const navTree = bundledContent.navTree
export const topicPages = bundledContent.topicPages
export const topicCount = bundledContent.topicCount

export {
  buildContent,
  buildNoteGraph,
  countTopicPages,
  crumbsForRoute,
  dirForIndex,
  dirForRoute,
  filterTree,
  firstPageRoute,
  hrefForNode,
  overviewNodes,
  flattenPages,
  GRAPH_ROUTE,
  groupLinkCounts,
  isGraphRoute,
  neighbors,
  pageByRoute,
  parseFrontmatter,
  resolveMdHref,
  routeFor,
  sectionForRoute,
} from './content-core.ts'

export type {
  Content,
  GraphEdge,
  GraphNode,
  MdHref,
  NavDirNode,
  NavNode,
  NavPageNode,
  NoteGraph,
  NotePage,
  Pages,
} from './content-core.ts'

export function parseHash(): string {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return decodeURIComponent(raw).replace(/\/$/, '')
}

export function setHash(route: string): void {
  const next = route ? `#/${route}` : '#/'
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}
