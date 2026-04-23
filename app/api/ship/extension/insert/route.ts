import { NextResponse } from 'next/server';
import { query, execute } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';

export async function POST(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
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
          , regist_date
          , regist_user
      )
      values (
            @vesselNo
          , @equipNo
          , @sectionCode
          , @planCode
          , (select coalesce(max(extension_seq), 0) + 1 
                from maintenance_extension 
              where vessel_no = @vesselNo
                and equip_no = @equipNo
                and section_code = @sectionCode
                and plan_code = @planCode)
          , @extensionDate
          , @extensionReason
          , now()::timestamp
          , @applicant
          , 'REQUEST'
          , now()::timestamp
          , @registUser
      );`,
      [
        { name: 'vesselNo', value: item.vessel_no }, 
        { name: 'equipNo', value: item.equip_no }, 
        { name: 'sectionCode', value: item.section_code }, 
        { name: 'planCode', value: item.plan_code }, 
        { name: 'extensionDate', value: item.extension_date }, 
        { name: 'extensionReason', value: item.extension_reason }, 
        { name: 'applicant', value: item.applicant }, 
        { name: 'registUser', value: item.regist_user },
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not inserted.' }, { status: 401 });
    }
    
    // 저장된 정비 정보 조회
    const sendData: MaintenanceExtension[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , plan_code
            , extension_seq
            , extension_date
            , extension_reason
            , request_date
            , applicant
            , approval_status
            , regist_date
            , regist_user
          from maintenance_extension
        where vessel_no = @vesselNo
          and equip_no = @equipNo
          and section_code = @sectionCode
          and plan_code = @planCode
          and extension_seq = (select max(extension_seq) 
                                  from maintenance_extension
                                where vessel_no = @vesselNo
                                  and equip_no = @equipNo
                                  and section_code = @sectionCode
                                  and plan_code = @planCode
                                  and regist_user = @registUser);`,
      [
        { name: 'vesselNo', value: item.vessel_no },
        { name: 'equipNo', value: item.equip_no },
        { name: 'sectionCode', value: item.section_code },
        { name: 'planCode', value: item.plan_code }, 
        { name: 'registUser', value: item.regist_user },
      ]
    );
    
    // 선박에서 저장된 정비 정보 전송
    if (sendData[0]) {
      fetch(`${remoteSiteUrl}/api/data/extension/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendData[0]),
      })
      .then(res => {
        if (res.ok) {
          // 정비 정보의 마지막 전송일자 수정
          execute(
            `update maintenance_extension
                set last_send_date = now()::timestamp
              where vessel_no = @vesselNo
                and equip_no = @equipNo
                and section_code = @sectionCode
                and plan_code = @planCode
                and extension_seq = @extensionSeq;`,
            [
              { name: 'vesselNo', value: sendData[0].vessel_no },
              { name: 'equipNo', value: item.equip_no },
              { name: 'sectionCode', value: item.section_code },
              { name: 'planCode', value: item.plan_code }, 
              { name: 'extensionSeq', value: item.extension_seq }, 
            ]
          );
        }
        
        return res.json();
      })
      .catch(err => {
        console.error('Error triggering cron job:', err);
      });
    }
    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}