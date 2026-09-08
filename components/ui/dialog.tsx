"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  draggable = false,
  style,
  onPointerDown,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** 헤더를 마우스로 잡아 창 위치를 이동할 수 있게 합니다. */
  draggable?: boolean
}) {
  // 이동 위치는 ref 로 들고 있다가 드래그가 끝날 때만 state 에 반영한다.
  // 마우스가 움직일 때마다 state 를 갱신하면 다이얼로그 전체가 다시 그려져 이동이 끊긴다.
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const offsetRef = React.useRef({ x: 0, y: 0 })
  const nodeRef = React.useRef<HTMLDivElement | null>(null)

  const applyOffset = (x: number, y: number) => {
    offsetRef.current = { x, y }
    const node = nodeRef.current
    if (node) node.style.translate = `calc(-50% + ${x}px) calc(-50% + ${y}px)`
  }

  // DialogContent 자체는 닫혀도 언마운트되지 않고 내부 DOM 노드만 교체되므로,
  // 창을 다시 열어 새 노드가 붙을 때 이동 위치를 초기화한다.
  // (Radix는 렌더링마다 ref를 재부착하므로 "노드가 바뀐 경우"만 걸러내야 한다)
  const userRef = React.useRef(ref)
  userRef.current = ref
  const lastNodeRef = React.useRef<HTMLDivElement | null>(null)
  const setContentRef = React.useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node

    if (node && node !== lastNodeRef.current) {
      lastNodeRef.current = node
      offsetRef.current = { x: 0, y: 0 }
      setOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
    }

    const r = userRef.current
    if (typeof r === "function") r(node)
    else if (r) (r as React.RefObject<HTMLDivElement | null>).current = node
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e)

    if (!draggable || e.button !== 0) return

    const target = e.target as HTMLElement
    // 헤더 영역을 잡았을 때만 이동, 버튼/입력 요소는 제외
    if (!target.closest('[data-slot="dialog-header"]')) return
    if (target.closest("button, input, textarea, select, a, [role='button']")) return

    const startX = e.clientX
    const startY = e.clientY
    const originX = offsetRef.current.x
    const originY = offsetRef.current.y

    let nextX = originX
    let nextY = originY

    // DialogContent 에는 열림/닫힘 연출용으로 duration-200 이 붙어 있는데,
    // 이 클래스는 지속시간만 정하고 대상은 기본값(all)이라 위치 변경까지 0.2초에 걸쳐 따라온다.
    // 드래그하는 동안에는 전환을 꺼서 마우스를 그대로 따라오게 한다.
    const node = nodeRef.current
    const prevTransition = node?.style.transition ?? ""
    if (node) node.style.transition = "none"

    // style 한 줄만 바꾸는 작업이라 이동할 때마다 바로 반영해도 부담이 없다.
    // (프레임 단위로 묶으면 그만큼 반응이 늦어진다)
    const handleMove = (ev: PointerEvent) => {
      nextX = originX + (ev.clientX - startX)
      nextY = originY + (ev.clientY - startY)
      applyOffset(nextX, nextY)
    }

    const handleUp = () => {
      if (node) node.style.transition = prevTransition
      // 드래그가 끝난 뒤에만 state 를 맞춰 다음 렌더링에서도 위치가 유지되게 한다.
      setOffset({ x: nextX, y: nextY })
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleUp)

    e.preventDefault()
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          draggable && "[&_[data-slot=dialog-header]]:cursor-move",
          className
        )}
        style={
          draggable
            ? {
                ...style,
                translate: `calc(-50% + ${offset.x}px) calc(-50% + ${offset.y}px)`,
              }
            : style
        }
        onPointerDown={handlePointerDown}
        ref={setContentRef}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
