const ATTRIBUTE = 'data-dsh-skin-nav-icon'

function isSkinNavButton(button: HTMLButtonElement, labels: ReadonlySet<string>): boolean {
  const label = button.querySelector(':scope > span')?.textContent?.trim()
  return button.querySelector(':scope > svg') !== null && label !== undefined && labels.has(label)
}

function syncSkinNavIcon(labels: ReadonlySet<string>): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(`[${ATTRIBUTE}]`)) {
    button.removeAttribute(ATTRIBUTE)
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('nav button')) {
    if (isSkinNavButton(button, labels)) button.setAttribute(ATTRIBUTE, '')
  }
}

/** The settings slot has no icon field, so decorate only the localized Skins row. */
export function installSkinNavIcon(labels: readonly string[]): () => void {
  const accepted = new Set(labels)
  const sync = (): void => syncSkinNavIcon(accepted)
  const observer = new MutationObserver(sync)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  sync()
  return () => {
    observer.disconnect()
    for (const button of document.querySelectorAll<HTMLButtonElement>(`[${ATTRIBUTE}]`)) {
      button.removeAttribute(ATTRIBUTE)
    }
  }
}
