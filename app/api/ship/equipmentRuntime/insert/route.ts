import { NextResponse } from 'next/server'
import { query } from '@/db'

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item = body;

    const vessel_no = item.vesselNo
    const equip_no = item.equipNo
    const equip_name = item.equipName
    const machine_name = item.machineName
    const runtime = item.runtime

    if (!vessel_no) {
      return NextResponse.json(
        { success: false, message: 'vesselNo is required' },
        { status: 400 }
      )
    }
    if (!equip_no) {
      return NextResponse.json(
        { success: false, message: 'equipNo is required' },
        { status: 400 }
      )
    }
    if (!equip_name) {
      return NextResponse.json(
        { success: false, message: 'equipNo is required' },
        { status: 400 }
      )
    }
    if (!machine_name) {
      return NextResponse.json(
        { success: false, message: 'machineName is required' },
        { status: 400 }
      )
    }
    if (!runtime) {
      return NextResponse.json(
        { success: false, message: 'runtime is required' },
        { status: 400 }
      )
    }
    
    await query(
      `EXEC dbo.usp_upsert_equipment_runtime
            @vessel_no,
            @machine_name,
            @equip_no,
            @equip_name,
            @runtime`,
      [
        { name: 'vessel_no', value: vessel_no },
        { name: 'machine_name', value: machine_name },
        { name: 'equip_no', value: equip_no },
        { name: 'equip_name', value: equip_name },
        { name: 'runtime', value: runtime }
      ]
    )

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    )
  }
}