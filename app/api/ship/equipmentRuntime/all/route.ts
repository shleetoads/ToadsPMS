import { NextResponse } from 'next/server'
import { query } from '@/db'
import { EquipmentRuntimeData , MachineRuntimeData } from '@/types/vessel/equipmentRuntime'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const vessel_no = url.searchParams.get('vesselNo')

    if (!vessel_no) {
      return NextResponse.json(
        { success: false, message: 'vesselNo is required' },
        { status: 400 }
      )
    }

    // 운전시간 패널은 MAIN ENGINE / GENERATOR ENGINE 두 그룹(ME, G·E)만 표시한다.
    // equipment(엔진 장비)를 기준으로 운전시간을 LEFT JOIN → 모든 선박이 두 그룹을 항상 표시하고,
    // 운전시간 레코드가 없거나 0이면 0으로 표시한다. (업로드 여부와 무관)
    const items: EquipmentRuntimeData[] = await query(
    `SELECT
       e.vessel_no,
       e.machine_name,
       e.equip_no,
       e.equip_name,
       er.lastest_upload_date,
       COALESCE(er.lastest_runtime, 0) AS lastest_runtime,
       er.prev_upload_date,
       er.prev_runtime
  FROM equipment e
  LEFT JOIN equipment_runtime er
    ON er.vessel_no    = e.vessel_no
   AND er.machine_name = e.machine_name
   AND er.equip_no     = e.equip_no
 WHERE e.vessel_no = @vesselNo
   AND e.machine_name IN ('MAIN ENGINE', 'GENERATOR ENGINE')
 ORDER BY
       e.machine_name,
       e.equip_no`,
         [
          {name: 'vesselNo', value: vessel_no}
         ]
    )

    const machineRuntimeDatas: MachineRuntimeData[] = Object.values(
      items.reduce((acc, item) => {
        const key = `${item.vessel_no}_${item.machine_name}`

        if (!acc[key]) {
          acc[key] = {
            vessel_no: item.vessel_no,
            machine_name: item.machine_name,
            equipment_runtime_datas: []
          }
        }

        acc[key].equipment_runtime_datas.push(item)

        return acc
      }, {} as Record<string, MachineRuntimeData>)
    )

    return NextResponse.json(machineRuntimeDatas)

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    )
  }
}