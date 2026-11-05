import { NextResponse } from 'next/server';
import { query } from '@/db'; // 이전에 만든 query 함수
import { Vessel } from '@/types/common/vessel'; // ✅ interface import
import { Codes } from '@/types/common/codes'; // ✅ interface import

export async function GET(req: Request) {
  try {
    // DB에서 데쉬보드 정보 확인
    const items: Codes[] = await query(
      `select a.vessel_no
            , a.vessel_name
            , a.code
            , a.name
            , a.type
         from (select 'machine' as type
                    , a.vessel_no
                    , a.vessel_name
                    , b.machine_name as code
                    , b.machine_name as name
                    , '' as location
                    , b.sort_no
                 from vessel as a
                 left outer join machine as b
                   on a.vessel_no = b.vessel_no
                where a.use_yn = 'Y'
               union all
               select 'warehouse'
                    , a.vessel_no
                    , a.vessel_name
                    , b.warehouse_no
                    , b.warehouse_name
                    , b.warehouse_location
                    , ROW_NUMBER() OVER (PARTITION BY a.vessel_no ORDER BY b.warehouse_no)
                 from vessel as a
                 left outer join warehouse as b
                   on a.vessel_no = b.vessel_no
                  and coalesce(b.delete_yn, 'N') = 'N'
                where a.use_yn = 'Y'
                  and b.use_yn = 'Y') as a
        order by a.vessel_no
               , a.sort_no`);

    let vessels: Vessel[] = [];
    let vessel: Vessel;

    let vesselNo: string = '';

    items.map(item => {
      if (vesselNo !== item.vessel_no) {
        vessel = {
          vessel_no: item.vessel_no,
          vessel_name: item.vessel_name,
          machines: [] = [],
          warehouses: [] =[],
        }

        vessels.push(vessel);
        vesselNo = item.vessel_no;
      }
      
      if (item.code) {
        if (item.type === 'machine') {
          vessel.machines.push({
            vessel_no: item.vessel_no,
            vessel_name: item.vessel_name,
            machine_name: item.name
          });
        }
        else {
          vessel.warehouses.push({
            vessel_no: item.vessel_no,
            vessel_name: item.vessel_name,
            warehouse_no: item.code,
            warehouse_name: item.name,
            warehouse_location: item.location
          });
        }
      }
    });

    // 성공 시 데쉬보드 정보 반환
    return NextResponse.json(vessels);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}