
-- ============ Directory organization ============
INSERT INTO public.organizations (id, name, type, status, metadata)
VALUES (
  '11111111-1111-1111-1111-000000000001',
  'Aden Public Healthcare Directory',
  'CLINIC',
  'active',
  '{"directory_only": true, "country": "YE", "governorate": "Aden"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============ Add only missing specialties ============
INSERT INTO public.hc_specialties (id, code, name_ar, name_en, sort_order) VALUES
  ('22222222-0000-0000-0000-000000000001','clinical_nutrition','التغذية العلاجية','Clinical Nutrition',10),
  ('1339a6a0-1d30-4193-b55a-5636ebd7ffc5','cardiology','أمراض القلب','Cardiology',20),
  ('65174b57-e380-433f-a5e1-3a46c77d39ea','orthopedics','جراحة العظام','Orthopedics',30),
  ('22222222-0000-0000-0000-000000000004','neurosurgery','جراحة المخ والأعصاب','Neurosurgery',40),
  ('fb087a4a-4655-4995-a7ba-f4c394ab4706','internal_medicine','الأمراض الباطنية','Internal Medicine',50),
  ('22222222-0000-0000-0000-000000000006','urology','جراحة المسالك البولية','Urology',60)
  ,('bb0f2827-e63c-4443-a6fc-e4fadb3c3b42','gynecology','النساء والولادة','Obstetrics and Gynecology',70)
ON CONFLICT (code) DO NOTHING;

-- ============ Hospitals ============
INSERT INTO public.hc_locations (id, organization_id, kind, name_ar, name_en, address, city, governorate, country, phone, whatsapp, working_hours, metadata) VALUES
  ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000001','hospital','مستشفى عدن الألماني الدولي','Aden German International Hospital','المنصورة - حي السنافر - الشارع العام','عدن','عدن','YE','02-329700','730597989','{"emergency": "24/7"}'::jsonb,'{"phones": ["02-329700","02-329701","02-329702"], "verified": true, "source": "public_directory"}'::jsonb),
  ('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-000000000001','hospital','المستشفى الأمريكي الحديث','Modern American Hospital','المنصورة - شارع التسعين','عدن','عدن','YE','02-389666',NULL,'{"emergency": "24/7"}'::jsonb,'{"phones": ["02-389666","02-383844","02-383855","02-386999"], "verified": true, "source": "public_directory"}'::jsonb),
  ('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-000000000001','hospital','مستشفى الوالي','Al-Wali Hospital','المنصورة - خلف مطابع الكتاب المدرسي','عدن','عدن','YE','02-397447',NULL,'{"emergency": "24/7"}'::jsonb,'{"phones": ["02-397447","02-393399"], "verified": true, "source": "public_directory"}'::jsonb),
  ('33333333-0000-0000-0000-000000000004','11111111-1111-1111-1111-000000000001','hospital','مستشفى صابر التخصصي','Saber Specialized Hospital','المنصورة - حي ريمي','عدن','عدن','YE','02-340267',NULL,'{"emergency": "24/7"}'::jsonb,'{"phones": ["02-340267","02-345925"], "verified": true, "source": "public_directory"}'::jsonb),
  ('33333333-0000-0000-0000-000000000005','11111111-1111-1111-1111-000000000001','hospital','مستشفى البريهي','Al-Buraihi Hospital','مديرية المنصورة','عدن','عدن','YE','02-242983','771177838','{"emergency": "24/7"}'::jsonb,'{"phones": ["02-242983","02-222349"], "verified": true, "source": "public_directory"}'::jsonb),
  ('33333333-0000-0000-0000-000000000006','11111111-1111-1111-1111-000000000001','hospital','المستشفى الجمهوري التعليمي','Al-Jumhouri Teaching Hospital','صيرة - كريتر','عدن','عدن','YE',NULL,NULL,'{"emergency": "24/7"}'::jsonb,'{"verified": true, "source": "public_directory", "notes": "Emergency accessible 24/7"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============ Doctors ============
INSERT INTO public.hc_doctors
  (id, organization_id, slug, full_name_ar, full_name_en, title, medical_title, verification_status, verified_at, is_public, source, confidence_score, normalized_name_ar)
VALUES
  ('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-000000000001','nahid-taher','د. ناهد طاهر','Dr. Nahid Taher','د.','أخصائية تغذية علاجية ورشاقة','verified',now(),true,'public_directory',90,'ناهد طاهر'),
  ('44444444-0000-0000-0000-000000000002','11111111-1111-1111-1111-000000000001','riam-al-bakri','د. ريام البكري','Dr. Riam Al-Bakri','د.','أخصائية تغذية علاجية وحميات','verified',now(),true,'public_directory',85,'ريام البكري'),
  ('44444444-0000-0000-0000-000000000003','11111111-1111-1111-1111-000000000001','haifa-al-dabbagh','د. هيفاء الدباغ','Dr. Haifa Al-Dabbagh','د.','استشارية تغذية عامة وعلاجية','verified',now(),true,'public_directory',85,'هيفاء الدباغ'),
  ('44444444-0000-0000-0000-000000000004','11111111-1111-1111-1111-000000000001','omar-baqrib','د. عمر باقريب','Dr. Omar Baqrib','د.','استشاري أمراض القلب والقسطرة','verified',now(),true,'public_directory',95,'عمر باقريب'),
  ('44444444-0000-0000-0000-000000000005','11111111-1111-1111-1111-000000000001','mohamed-al-saadi','د. محمد السعدي','Dr. Mohamed Al-Saadi','د.','استشاري طب وجراحة القلب','verified',now(),true,'public_directory',90,'محمد السعدي'),
  ('44444444-0000-0000-0000-000000000006','11111111-1111-1111-1111-000000000001','shawqi-abdulwahid','د. شوقي عبد الواحد','Dr. Shawqi Abdulwahid','د.','أخصائي أمراض القلب والأوعية الدموية','verified',now(),true,'public_directory',85,'شوقي عبد الواحد'),
  ('44444444-0000-0000-0000-000000000007','11111111-1111-1111-1111-000000000001','abdelfattah-al-saeedi','د. عبد الفتاح السعيدي','Dr. Abdelfattah Al-Saeedi','د.','استشاري جراحة العظام والمفاصل','verified',now(),true,'public_directory',95,'عبد الفتاح السعيدي'),
  ('44444444-0000-0000-0000-000000000008','11111111-1111-1111-1111-000000000001','junaid-mohamed-junaid','د. جنيد محمد جنيد','Dr. Junaid Mohamed Junaid','د.','استشاري جراحة العظام والكسور','verified',now(),true,'public_directory',90,'جنيد محمد جنيد'),
  ('44444444-0000-0000-0000-000000000009','11111111-1111-1111-1111-000000000001','mohamed-al-shuaibi','د. محمد صالح الشعيبي','Dr. Mohamed Saleh Al-Shuaibi','د.','أخصائي جراحة عظام','verified',now(),true,'public_directory',85,'محمد صالح الشعيبي'),
  ('44444444-0000-0000-0000-000000000010','11111111-1111-1111-1111-000000000001','qasem-al-asbahi','أ.د. قاسم الأصبحي','Prof. Qasem Al-Asbahi','أ.د.','بروفيسور واستشاري جراحة المخ والأعصاب','verified',now(),true,'public_directory',95,'قاسم الأصبحي'),
  ('44444444-0000-0000-0000-000000000011','11111111-1111-1111-1111-000000000001','tareq-mazida','د. طارق مزيدة','Dr. Tareq Mazida','د.','استشاري جراحة المخ والأعصاب','verified',now(),true,'public_directory',90,'طارق مزيدة'),
  ('44444444-0000-0000-0000-000000000012','11111111-1111-1111-1111-000000000001','adnan-al-abdali','د. عدنان العبدلي','Dr. Adnan Al-Abdali','د.','أخصائي جراحة المخ والأعصاب والعمود الفقري','verified',now(),true,'public_directory',85,'عدنان العبدلي'),
  ('44444444-0000-0000-0000-000000000013','11111111-1111-1111-1111-000000000001','amin-al-saadi','د. أمين السعدي','Dr. Amin Al-Saadi','د.','استشاري الأمراض الباطنية والسكري','verified',now(),true,'public_directory',90,'أمين السعدي'),
  ('44444444-0000-0000-0000-000000000014','11111111-1111-1111-1111-000000000001','ahmed-al-haithami','د. أحمد الهيثمي','Dr. Ahmed Al-Haithami','د.','أخصائي الباطنية والقلب','verified',now(),true,'public_directory',85,'أحمد الهيثمي'),
  ('44444444-0000-0000-0000-000000000015','11111111-1111-1111-1111-000000000001','raja-masaad','د. رجاء مسعد','Dr. Raja Masaad','د.','أخصائية الأمراض الباطنية والغدد','verified',now(),true,'public_directory',85,'رجاء مسعد'),
  ('44444444-0000-0000-0000-000000000016','11111111-1111-1111-1111-000000000001','abdelqader-al-abadi','د. عبد القادر العبادي','Dr. Abdelqader Al-Abadi','د.','استشاري جراحة المسالك البولية','verified',now(),true,'public_directory',90,'عبد القادر العبادي'),
  ('44444444-0000-0000-0000-000000000017','11111111-1111-1111-1111-000000000001','najeeb-maisari','د. نجيب ميسري','Dr. Najeeb Maisari','د.','أخصائي أمراض وجراحة المسالك البولية','verified',now(),true,'public_directory',85,'نجيب ميسري'),
  ('44444444-0000-0000-0000-000000000018','11111111-1111-1111-1111-000000000001','huda-badhib','د. هدى باذيب','Dr. Huda Badhib','د.','استشارية أمراض النساء والولادة والعقم','verified',now(),true,'public_directory',95,'هدى باذيب'),
  ('44444444-0000-0000-0000-000000000019','11111111-1111-1111-1111-000000000001','ayad-fadl','د. أعياد فضل','Dr. Ayad Fadl','د.','أخصائية نساء وولادة','verified',now(),true,'public_directory',85,'أعياد فضل'),
  ('44444444-0000-0000-0000-000000000020','11111111-1111-1111-1111-000000000001','shafiqa-bahshwan','د. شفيقة باحشوان','Dr. Shafiqa Bahshwan','د.','استشارية النساء والولادة','verified',now(),true,'public_directory',90,'شفيقة باحشوان')
ON CONFLICT (slug) DO NOTHING;

-- ============ Doctor ↔ Specialty (using ACTUAL existing IDs) ============
-- clinical_nutrition:  22222222-0000-0000-0000-000000000001 (new)
-- cardiology:          1339a6a0-1d30-4193-b55a-5636ebd7ffc5 (existing)
-- orthopedics:         65174b57-e380-433f-a5e1-3a46c77d39ea (existing)
-- neurosurgery:        22222222-0000-0000-0000-000000000004 (new)
-- internal_medicine:   fb087a4a-4655-4995-a7ba-f4c394ab4706 (existing)
-- urology:             22222222-0000-0000-0000-000000000006 (new)
-- gynecology (OB/GYN): bb0f2827-e63c-4443-a6fc-e4fadb3c3b42 (existing)
INSERT INTO public.hc_doctor_specialties (doctor_id, specialty_id, is_primary) VALUES
  ('44444444-0000-0000-0000-000000000001',(SELECT id FROM public.hc_specialties WHERE code='clinical_nutrition'),true),
  ('44444444-0000-0000-0000-000000000002',(SELECT id FROM public.hc_specialties WHERE code='clinical_nutrition'),true),
  ('44444444-0000-0000-0000-000000000003',(SELECT id FROM public.hc_specialties WHERE code='clinical_nutrition'),true),
  ('44444444-0000-0000-0000-000000000004',(SELECT id FROM public.hc_specialties WHERE code='cardiology'),true),
  ('44444444-0000-0000-0000-000000000005',(SELECT id FROM public.hc_specialties WHERE code='cardiology'),true),
  ('44444444-0000-0000-0000-000000000006',(SELECT id FROM public.hc_specialties WHERE code='cardiology'),true),
  ('44444444-0000-0000-0000-000000000007',(SELECT id FROM public.hc_specialties WHERE code='orthopedics'),true),
  ('44444444-0000-0000-0000-000000000008',(SELECT id FROM public.hc_specialties WHERE code='orthopedics'),true),
  ('44444444-0000-0000-0000-000000000009',(SELECT id FROM public.hc_specialties WHERE code='orthopedics'),true),
  ('44444444-0000-0000-0000-000000000010',(SELECT id FROM public.hc_specialties WHERE code='neurosurgery'),true),
  ('44444444-0000-0000-0000-000000000011',(SELECT id FROM public.hc_specialties WHERE code='neurosurgery'),true),
  ('44444444-0000-0000-0000-000000000012',(SELECT id FROM public.hc_specialties WHERE code='neurosurgery'),true),
  ('44444444-0000-0000-0000-000000000013',(SELECT id FROM public.hc_specialties WHERE code='internal_medicine'),true),
  ('44444444-0000-0000-0000-000000000014',(SELECT id FROM public.hc_specialties WHERE code='internal_medicine'),true),
  ('44444444-0000-0000-0000-000000000015',(SELECT id FROM public.hc_specialties WHERE code='internal_medicine'),true),
  ('44444444-0000-0000-0000-000000000016',(SELECT id FROM public.hc_specialties WHERE code='urology'),true),
  ('44444444-0000-0000-0000-000000000017',(SELECT id FROM public.hc_specialties WHERE code='urology'),true),
  ('44444444-0000-0000-0000-000000000018',(SELECT id FROM public.hc_specialties WHERE code='gynecology'),true),
  ('44444444-0000-0000-0000-000000000019',(SELECT id FROM public.hc_specialties WHERE code='gynecology'),true),
  ('44444444-0000-0000-0000-000000000020',(SELECT id FROM public.hc_specialties WHERE code='gynecology'),true)
ON CONFLICT DO NOTHING;

-- ============ Doctor ↔ Location ============
INSERT INTO public.hc_doctor_locations (doctor_id, location_id, role) VALUES
  ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000001','consultant'),
  ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000006','33333333-0000-0000-0000-000000000002','consultant'),
  ('44444444-0000-0000-0000-000000000007','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000007','33333333-0000-0000-0000-000000000005','consultant'),
  ('44444444-0000-0000-0000-000000000008','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000009','33333333-0000-0000-0000-000000000002','consultant'),
  ('44444444-0000-0000-0000-000000000009','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000010','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000011','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000011','33333333-0000-0000-0000-000000000006','consultant'),
  ('44444444-0000-0000-0000-000000000012','33333333-0000-0000-0000-000000000005','consultant'),
  ('44444444-0000-0000-0000-000000000012','33333333-0000-0000-0000-000000000001','consultant'),
  ('44444444-0000-0000-0000-000000000013','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000014','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000015','33333333-0000-0000-0000-000000000005','consultant'),
  ('44444444-0000-0000-0000-000000000016','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000017','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000017','33333333-0000-0000-0000-000000000005','consultant'),
  ('44444444-0000-0000-0000-000000000018','33333333-0000-0000-0000-000000000004','consultant'),
  ('44444444-0000-0000-0000-000000000019','33333333-0000-0000-0000-000000000003','consultant'),
  ('44444444-0000-0000-0000-000000000019','33333333-0000-0000-0000-000000000002','consultant'),
  ('44444444-0000-0000-0000-000000000020','33333333-0000-0000-0000-000000000001','consultant')
ON CONFLICT DO NOTHING;

-- ============ Emergency hotline ============
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'emergency_hotline_aden',
  '{"number": "195", "name_ar": "الطوارئ والإسعاف - عدن", "backup_lines": ["02-358259","02-358260","02-354913","02-354914","02-354915"], "free_from_yemen_mobile": true}'::jsonb,
  'Aden emergency ambulance hotline (Ministry of Health)'
)
ON CONFLICT (key) DO NOTHING;
