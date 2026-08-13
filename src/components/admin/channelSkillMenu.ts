import { orderSkillMenuItems } from '../../lib/skill-menu-order.js'

export interface ChannelSkillAgentOption {
  id: string
  name: string
  role?: string
  skills?: string[]
}

export interface ChannelSkillCatalogItem {
  name: string
  display_name?: string
  description?: string
  icon_url?: string
}

export interface ChannelTemplateSkillMenuItem extends ChannelSkillCatalogItem {
  agents: ChannelSkillAgentOption[]
}

export function buildChannelTemplateSkillMenu(
  selectedAgentIDs: string[],
  configuredOrder: unknown,
  availableAgents: ChannelSkillAgentOption[],
  catalog: ChannelSkillCatalogItem[],
): ChannelTemplateSkillMenuItem[] {
  const agentsByID = new Map(availableAgents.map((agent) => [agent.id, agent]))
  const catalogByName = new Map(catalog.map((skill) => [skill.name, skill]))
  const byName = new Map<string, ChannelTemplateSkillMenuItem>()

  for (const agentID of selectedAgentIDs) {
    const agent = agentsByID.get(agentID)
    if (!agent) continue
    for (const rawName of agent.skills ?? []) {
      const name = rawName.trim()
      if (!name) continue
      const existing = byName.get(name)
      if (existing) {
        if (!existing.agents.some((item) => item.id === agent.id)) existing.agents.push(agent)
        continue
      }
      const summary = catalogByName.get(name)
      byName.set(name, {
        name,
        display_name: summary?.display_name || name,
        description: summary?.description,
        icon_url: summary?.icon_url,
        agents: [agent],
      })
    }
  }

  return orderSkillMenuItems([...byName.values()], configuredOrder)
}
