/**
 * 수정 창 안에서 값이 잘려 보이는 항목에 전체 값을 보여주는 툴팁.
 *
 * 브라우저 기본 툴팁(title 속성)은 뜨기까지 1초 이상 걸리고 모양도 바꿀 수 없어,
 * `data-tip` 속성이 붙은 요소를 감지해 직접 그린다.
 *
 * 문서 전체에 리스너를 한 번만 설치하고, 툴팁 요소도 하나만 만들어 재사용한다.
 */

const TIP_ATTR = "data-tip"
const SHOW_DELAY = 120 // 기본 툴팁(약 1초)보다 훨씬 빠르게

let installed = false
let tipEl: HTMLDivElement | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null
let currentTarget: HTMLElement | null = null

const STYLE = `
[data-slot="field-tooltip"] {
  position: fixed;
  z-index: 100;
  max-width: 28rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.375rem;
  background: #1d2b31;
  color: #f2f6f6;
  font-size: 0.8125rem;
  line-height: 1.45;
  font-weight: 400;
  white-space: normal;
  overflow-wrap: anywhere;
  box-shadow: 0 6px 16px -4px rgb(0 0 0 / 0.35), 0 2px 4px -2px rgb(0 0 0 / 0.25);
  pointer-events: none;
  opacity: 0;
  translate: 0 3px;
  transition: opacity 90ms ease-out, translate 90ms ease-out;
}
[data-slot="field-tooltip"][data-state="open"] {
  opacity: 1;
  translate: 0 0;
}
[data-slot="field-tooltip"]::after {
  content: "";
  position: absolute;
  left: var(--tip-arrow-x, 50%);
  translate: -50% 0;
  border: 5px solid transparent;
}
[data-slot="field-tooltip"][data-side="top"]::after {
  top: 100%;
  border-top-color: #1d2b31;
}
[data-slot="field-tooltip"][data-side="bottom"]::after {
  bottom: 100%;
  border-bottom-color: #1d2b31;
}
@media (prefers-reduced-motion: reduce) {
  [data-slot="field-tooltip"] { transition: none; }
}
`

function ensureElements() {
  if (tipEl) return tipEl

  if (!document.getElementById("field-tooltip-style")) {
    const style = document.createElement("style")
    style.id = "field-tooltip-style"
    style.textContent = STYLE
    document.head.appendChild(style)
  }

  tipEl = document.createElement("div")
  tipEl.setAttribute("data-slot", "field-tooltip")
  tipEl.setAttribute("role", "tooltip")
  tipEl.hidden = true
  document.body.appendChild(tipEl)

  return tipEl
}

function place(target: HTMLElement) {
  const tip = tipEl
  if (!tip) return

  const box = target.getBoundingClientRect()
  const tipBox = tip.getBoundingClientRect()
  const GAP = 8

  // 기본은 위쪽, 자리가 모자라면 아래쪽으로 뒤집는다.
  const side = box.top - tipBox.height - GAP >= 0 ? "top" : "bottom"
  const top = side === "top" ? box.top - tipBox.height - GAP : box.bottom + GAP

  // 가로는 대상 중앙 정렬하되 화면 밖으로 나가지 않게 잡아둔다.
  const wanted = box.left + box.width / 2 - tipBox.width / 2
  const left = Math.max(8, Math.min(wanted, window.innerWidth - tipBox.width - 8))

  tip.dataset.side = side
  tip.style.top = `${Math.round(top)}px`
  tip.style.left = `${Math.round(left)}px`
  tip.style.setProperty("--tip-arrow-x", `${Math.round(box.left + box.width / 2 - left)}px`)
}

function hide() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  currentTarget = null
  if (!tipEl) return
  tipEl.removeAttribute("data-state")
  tipEl.hidden = true
}

function show(target: HTMLElement) {
  const text = target.getAttribute(TIP_ATTR)
  if (!text) return

  const tip = ensureElements()
  currentTarget = target

  showTimer = setTimeout(() => {
    showTimer = null
    if (currentTarget !== target || !target.isConnected) return

    tip.textContent = text
    tip.hidden = false
    // 크기를 잰 뒤 위치를 잡고 나타나게 한다.
    place(target)
    // 강제 리플로우로 시작 상태를 확정한다.
    // (requestAnimationFrame 에 기대면 프레임이 돌지 않는 상황에서 툴팁이 보이지 않는다)
    void tip.offsetHeight
    tip.setAttribute("data-state", "open")
  }, SHOW_DELAY)
}

function findTipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest(`[${TIP_ATTR}]`)
  return el instanceof HTMLElement ? el : null
}

/** 문서에 한 번만 리스너를 설치한다. 여러 번 호출해도 안전하다. */
export function installFieldTooltip() {
  if (installed || typeof document === "undefined") return
  installed = true

  document.addEventListener(
    "pointerover",
    (e) => {
      const target = findTipTarget(e.target)
      if (!target) {
        if (currentTarget) hide()
        return
      }
      if (target === currentTarget) return
      hide()
      show(target)
    },
    true
  )

  document.addEventListener("pointerdown", hide, true)
  document.addEventListener("scroll", hide, true)
  window.addEventListener("blur", hide)
}
