import { NextResponse } from 'next/server';
import { query, withTransaction, adaptNamedParams, NamedParam } from '@/db';
import { PMSData } from '@/types/data/pms_data';
import { Vessel } from '@/types/vessel/vessel';
import { Equipment } from '@/types/vessel/equipment';
import { Section } from '@/types/vessel/section';
import { MaintenancePlan } from '@/types/vessel/maintenance_plan';
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';
import { MaintenanceWork } from '@/types/vessel/maintenance_work';
import { UsedParts } from "@/types/vessel/used_parts";

import { Warehouse } from '@/types/inventory/warehouse/warehouse';
import { Material } from '@/types/inventory/material/material';
import { Receive } from '@/types/inventory/receive/receive';
import { Release } from '@/types/inventory/release/release';
import { Loss } from '@/types/inventory/loss/loss';

export async function GET(req: Request) {
  try {
    const remoteSiteUrl = process.env.REMOTE_SITE_URL;
    let vesselNo = process.env.VESSEL;
    if (!vesselNo)
      vesselNo = ''

    if (!remoteSiteUrl)
      return NextResponse.json({ success: true });

    const vessels: Vessel[] = await query(
      `select vessel_no
            , vessel_name
            , imo_no
            , use_yn
            , vessel_short_name
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from vessel
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const equipments: Equipment[] = await query(
      `select vessel_no
            , equip_no
            , equip_name
            , manufacturer
            , model
            , specifications
            , description
            , category
            , lastest_date
            , machine_name
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from equipment
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const sections: Section[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , section_name
            , description
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from section
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const maintenances: MaintenancePlan[] = await query(
      `select vessel_no
            , equip_no
            , section_code
            , plan_code
            , plan_name
            , manufacturer
            , model
            , specifications
            , lastest_date
            , workers
            , work_hours
            , interval
            , interval_term
            , location
            , self_maintenance
            , manager
            , important_items
            , instructions
            , critical
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from maintenance_plan
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const extensions: MaintenanceExtension[] = await query(
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
            , approval_date
            , approver
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from maintenance_extension
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const works: MaintenanceWork[] = await query(
      `select work_order
            , work_date
            , manager
            , work_details
            , used_parts
            , work_hours
            , delay_reason
            , plan_date
            , vessel_no
            , equip_no
            , section_code
            , plan_code
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from maintenance_work
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const usedParts: UsedParts[] = await query(
      `select vessel_no
            , work_order
            , part_seq
            , warehouse_no
            , material_code
            , use_unit
            , use_qty
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from used_parts
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const warehouses: Warehouse[] = await query(
      `select vessel_no
            , warehouse_no
            , warehouse_name
            , warehouse_desc
            , warehouse_location
            , use_yn
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from warehouse
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const materials: Material[] = await query(
      `select vessel_no
            , material_code
            , machine_name
            , material_name
            , material_group
            , material_spec
            , material_type
            , material_unit
            , warehouse_no
            , drawing_no
            , standard_qty
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from material
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const receives: Receive[] = await query(
      `select vessel_no
            , receive_no
            , material_code
            , receive_date
            , receive_type
            , receive_unit
            , receive_qty
            , receive_location
            , delivery_location
            , receive_remark
            , receive_reason
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from receive
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const releases: Release[] = await query(
      `select vessel_no
            , release_no
            , material_code
            , release_date
            , release_type
            , release_unit
            , release_qty
            , release_location
            , release_remark
            , release_reason
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from "release"
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const losses: Loss[] = await query(
      `select vessel_no
            , loss_no
            , material_code
            , loss_date
            , loss_unit
            , loss_qty
            , loss_type
            , loss_location
            , loss_reason
            , loss_remark
            , regist_date
            , regist_user
            , modify_date
            , modify_user
         from loss
        where vessel_no = @vesselNo
          and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
          and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'))`,
      [
        { name: 'vesselNo', value: vesselNo }
      ]
    );

    const sendPmsData : PMSData = {
      vessel_no: vesselNo,
      last_receive_date: '',
      vessels: vessels,
      equipments: equipments,
      sections: sections,
      maintenances: maintenances,
      extensions: extensions,
      works: works,
      machines: [],
      usedParts: usedParts,
      warehouses: warehouses,
      materials: materials,
      receives: receives,
      releases: releases,
      losses: losses
    };

    const response = await fetch(`${remoteSiteUrl}/api/data/all/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPmsData),
    });

    if (response.ok) {
      try {
        await withTransaction(async (client) => {
          const params: NamedParam[] = [{ name: 'vesselNo', value: vesselNo }];

          const updates = [
            `update vessel
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update equipment
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update section
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update maintenance_plan
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update maintenance_extension
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update maintenance_work
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update warehouse
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update material
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update receive
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update "release"
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
            `update loss
               set last_send_date = now()::timestamp
             where vessel_no = @vesselNo
               and (regist_date > coalesce(last_send_date, '1900-01-01') or modify_date > coalesce(last_send_date, '1900-01-01'))
               and (regist_date > coalesce(last_receive_date, '1900-01-01') or modify_date > coalesce(last_receive_date, '1900-01-01'));`,
          ];

          for (const queryString of updates) {
            const { text, values } = adaptNamedParams(queryString, params);
            await client.query(text, values);
          }
        });
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error(err);
        return NextResponse.json({ success: false, message: 'Server error!' }, { status: 500 });
      }
    }
    else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
