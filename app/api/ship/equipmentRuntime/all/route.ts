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

    const items: EquipmentRuntimeData[] = await query(
    `WITH HourEquipment AS (
    SELECT DISTINCT
           mp.vessel_no,
           e.machine_name,
           mp.equip_no,
           e.equip_name
      FROM maintenance_plan mp
      JOIN equipment e
        ON mp.vessel_no = e.vessel_no
       AND mp.equip_no  = e.equip_no
     WHERE mp.interval_term = 'HOURS'
       AND mp.vessel_no = @vesselNo
)
SELECT
       he.vessel_no,
       he.machine_name,
       he.equip_no,
       he.equip_name,
       er.lastest_upload_date,
       er.lastest_runtime,
       er.prev_upload_date,
       er.prev_runtime
  FROM HourEquipment he
  LEFT JOIN equipment_runtime er
    ON er.vessel_no    = he.vessel_no
   AND er.machine_name = he.machine_name
   AND er.equip_no     = he.equip_no
 ORDER BY
       he.machine_name,
       he.equip_no`,
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