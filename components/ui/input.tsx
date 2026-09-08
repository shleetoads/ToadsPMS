import * as React from "react"

import { cn } from "@/lib/utils"
import { installFieldTooltip } from "@/components/ui/field-tooltip"

function Input({ className, type, title, ...props }: React.ComponentProps<"input">) {
  // 수정 창 안에서 값이 칸보다 길어 잘려 보이는 경우에만,
  // 마우스를 올렸을 때 전체 값이 보이도록 툴팁을 붙인다.
  // (title 을 직접 지정했거나 비밀번호 입력인 경우에는 붙이지 않는다)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const node = inputRef.current
    if (!node) return

    const inDialog = !!node.closest('[data-slot="dialog-content"]')

    if (inDialog && title === undefined && type !== "password") {
      const overflows = node.scrollWidth > node.clientWidth + 1
      if (overflows && node.value) {
        node.setAttribute("data-tip", node.value)
        installFieldTooltip()
      } else {
        node.removeAttribute("data-tip")
      }
    }

    // 비활성 입력칸은 기본적으로 마우스 이벤트를 받지 않아 툴팁이 뜨지 않는다.
    // 툴팁이 붙어 있을 때만 마우스 이벤트를 되살리고, 금지 표시 커서는 쓰지 않는다.
    if (node.disabled && node.hasAttribute("data-tip")) {
      node.style.pointerEvents = "auto"
      node.style.cursor = "default"
    } else {
      node.style.pointerEvents = ""
      node.style.cursor = ""
    }
  })

  return (
    <input
      ref={inputRef}
      type={type}
      title={title}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
