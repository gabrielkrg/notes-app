import rawPages from 'virtual:notes-pages'
import { buildContent, formatRouteHash, parseRouteHash, type RouteHash } from './content-core.ts'

export const bundledRawPages = rawPages
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
  hoistNavRoot,
  hrefForNode,
  compareNavNodes,
  overviewNodes,
  flattenPages,
  GRAPH_ROUTE,
  groupLinkCounts,
  isGraphRoute,
  neighbors,
  pageByRoute,
  parseFrontmatter,
  formatRouteHash,
  parseRouteHash,
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
  RouteHash,
} from './content-core.ts'

export function parseHash(): RouteHash {
  return parseRouteHash(window.location.hash)
}

export function setHash(route: string, split = ''): void {
  const next = formatRouteHash(route, split)
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}
