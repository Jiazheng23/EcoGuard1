import { useEffect } from 'react'

export default function ModalInteractionGuard() {
  useEffect(() => {
    let restoreIsolation = () => {}

    function isolateActiveModal() {
      restoreIsolation()

      const modal = [...document.querySelectorAll('[aria-modal="true"]')].at(-1)
      if (!modal) {
        restoreIsolation = () => {}
        return
      }

      const isolatedSiblings = []
      let branch = modal
      let parent = branch.parentElement

      while (parent) {
        for (const sibling of parent.children) {
          if (sibling !== branch && !sibling.hasAttribute('inert')) {
            sibling.setAttribute('inert', '')
            isolatedSiblings.push(sibling)
          }
        }
        if (parent === document.body) break
        branch = parent
        parent = parent.parentElement
      }

      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      if (!modal.contains(document.activeElement)) {
        const focusTarget = modal.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        focusTarget?.focus({ preventScroll: true })
      }
      restoreIsolation = () => {
        isolatedSiblings.forEach((element) => element.removeAttribute('inert'))
        document.body.style.overflow = previousOverflow
      }
    }

    const observer = new MutationObserver(isolateActiveModal)
    observer.observe(document.body, { childList: true, subtree: true })
    isolateActiveModal()

    return () => {
      observer.disconnect()
      restoreIsolation()
    }
  }, [])

  return null
}
