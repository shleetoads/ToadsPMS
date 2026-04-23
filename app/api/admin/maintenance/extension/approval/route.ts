import { NextResponse } from 'next/server';
import { execute } from '@/db'; // 이전에 만든 query 함수
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item : MaintenanceExtension = body;

    let count = await execute(`
      update maintenance_extension
         set approval_date = now()::timestamp
           , approver = @approver
           , approval_status = @approvalStatus
           , approval_reason = @approvalReason
           , modify_date = now()::timestamp
           , modify_user = @modifyUser
       where vessel_no = @vesselNo
         and equip_no = @equipNo
         and section_code = @sectionCode
         and plan_code = @planCode
         and extension_seq = @extensionSeq;`,
      [
        { name: 'approvalDate', value: item.approval_date }, 
        { name: 'approver', value: item.approver }, 
        { name: 'approvalStatus', value: item.approval_status }, 
        { name: 'approvalReason', value: item.approval_reason }, 
        { name: 'modifyUser', value: item.regist_user },
        { name: 'vesselNo', value: item.vessel_no }, 
        { name: 'equipNo', value: item.equip_no }, 
        { name: 'sectionCode', value: item.section_code }, 
        { name: 'planCode', value: item.plan_code }, 
        { name: 'extensionSeq', value: item.extension_seq }, 
      ]
    );

    if (count === 0) {
      return NextResponse.json({ success: false, message: 'Data was not updated.' }, { status: 401 });
    }

    // 성공 정보 반환
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}