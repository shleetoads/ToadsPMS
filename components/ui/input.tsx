import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, title, ...props }: React.ComponentProps<"input">) {
  // 수정 다이얼로그 안에서 값이 칸보다 길어 잘려 보이는 경우에만,
  // 마우스를 올렸을 때 전체 값이 보이도록 툴팁을 붙인다.
  // (title 을 직접 지정했거나 비밀번호 입력인 경우에는 붙이지 않는다)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const node = inputRef.current
    if (!node) return

    const inDialog = !!node.closest('[data-slot="dialog-content"]')

    if (inDialog && title === undefined && type !== "password") {
      const overflows = node.scrollWidth > node.clientWidth + 1
      if (overflows && node.value) node.setAttribute("title", node.value)
      else node.removeAttribute("title")
    }

    // 비활성 입력칸은 기본적으로 마우스 이벤트를 받지 않아 툴팁이 뜨지 않는다.
    // 툴팁이 붙어 있을 때만 마우스 이벤트를 되살린다(입력은 여전히 불가).
    if (node.disabled && node.getAttribute("title")) node.style.pointerEvents = "auto"
    else node.style.pointerEvents = ""
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
