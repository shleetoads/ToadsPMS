import { useEffect, useState } from "react"

interface Props {
  equip_name: string
  machine_name: string
  handleRuntimeChanged: (runtime: number) => void
}

export default function EquipmentRuntimeInput({
  equip_name,
  machine_name,
  handleRuntimeChanged,
}: Props) {

  const [hour, setHour] = useState("")
  const [min, setMin] = useState("")
  const [runtime, setRuntime] = useState(0)

  useEffect(() => {
    const h = Number(hour || 0)
    const m = Number(min || 0)

    setRuntime(h * 60 + m)
  }, [hour, min])

  useEffect(() => {
    handleRuntimeChanged(runtime)
  }, [runtime])

  return (
    <div>
      <p className="text-xs mb-2">
        {equip_name} ({machine_name}) 운전 시간
      </p>

      <div className="flex items-end gap-2">

        {/* HOURS */}
        <input
          className="w-60 h-12 text-center border rounded"
          type="number"
          value={hour}
          onChange={(e) => {
            let value = e.target.value

            if (Number(value) < 0) value = "0"

            // 010 → 10 처리
            value = value === "" ? "" : String(Number(value))

            setHour(value)
          }}
        />

        <span>hr</span>

        {/* MINUTES */}
        <input
          className="w-20 h-12 text-center border rounded"
          type="number"
          value={min}
          onChange={(e) => {
            let value = Number(e.target.value)

            if (value > 59) value = 0
            if (value < 0) value = 59

            setMin(String(value))
          }}
        />

        <span>min</span>
      </div>
    </div>
  )
}