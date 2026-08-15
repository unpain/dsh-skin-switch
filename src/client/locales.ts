export const SKIN_SETTINGS_NS = 'settings.skins'

export const zh = {
  nav: '皮肤',
  title: '界面皮肤',
  description: '完整皮肤会改变背景、装饰和界面样式；明暗模式仍在通用设置中控制。',
  defaultName: 'DSH 默认',
  defaultDescription: '恢复 DeepSeek Harness 原生界面。',
  author: '作者：{name}',
  selected: '当前皮肤',
  switching: '正在切换皮肤…',
  error: '切换失败：{message}',
} as const

export type SkinSettingsKey = keyof typeof zh

export const en: Record<SkinSettingsKey, string> = {
  nav: 'Skins',
  title: 'Interface skin',
  description: 'Full skins change backgrounds, ornaments, and interface styling. Light and dark mode remain under General.',
  defaultName: 'DSH Default',
  defaultDescription: 'Restore the native DeepSeek Harness interface.',
  author: 'Author: {name}',
  selected: 'Current skin',
  switching: 'Switching skin…',
  error: 'Switch failed: {message}',
}
