import { NextResponse } from 'next/server';
import { query, execute } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : MaintenanceExtension = body;

    let count = await execute(`
      insert into maintenance_extension (
              vessel_no
            , equip_no
            , section_code
            , plan_code
            , extension_seq
            , extension_date
            , extension_reason
            , request_date
            , applicant
            , approval_status
            , last_receive_date
            , regist_date
            , regist_user
      )
      values (
              @vesselNo
            , @equipNo
            , @sectionCode
            , @planCode
            , @extensionSeq
            , @extensionDate
            , @extensionReason
            , now()::timestamp
            , @applicant
            , 'R'
            , now()::timestamp
            , now()::timestamp
            , @registUser
      );`, 
      [
        { name: 'vesselNo', value: item.vessel_no }, 
        { name: 'equipNo', value: item.equip_no }, 
        { name: 'sectionCode', value: item.section_code }, 
        { name: 'planCode', value: item.plan_code }, 
        { name: 'extensionSeq', value: item.extension_seq }, 
        { name: 'extensionDate', value: item.extension_date }, 
        { name: 'extensionReason', value: item.extension_reason }, 
        { name: 'applicant', value: item.applicant }, 
        { name: 'registUser', value: item.regist_user },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }
    
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}