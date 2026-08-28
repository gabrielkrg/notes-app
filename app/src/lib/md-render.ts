import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import { remarkPartialTasks } from './md-task.ts'

export const markdownRemarkPlugins = [remarkGfm, remarkBreaks, remarkPartialTasks]
