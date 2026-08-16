
INSERT INTO public.catalog_categories (id, name_ar, name_en, slug)
SELECT gen_random_uuid(), x.ar, x.en, x.slug FROM (VALUES
  ('مسكنات وخافضات حرارة','Pain & Fever','pain-fever'),
  ('البرد والإنفلونزا','Cold & Flu','cold-flu'),
  ('الفيتامينات والمكملات','Vitamins & Supplements','vitamins'),
  ('العناية بالبشرة','Skin Care','skin-care'),
  ('الأم والطفل','Mother & Baby','mother-baby'),
  ('العناية الشخصية','Personal Hygiene','hygiene'),
  ('الجهاز الهضمي','Digestive Health','digestive'),
  ('الإسعافات الأولية','First Aid','first-aid')
) AS x(ar,en,slug)
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_categories c WHERE c.slug = x.slug);

DO $$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-000000000001';
  v_pain uuid; v_cold uuid; v_vit uuid; v_skin uuid;
  v_baby uuid; v_hyg uuid; v_dig uuid; v_first uuid;
BEGIN
  SELECT id INTO v_pain  FROM public.catalog_categories WHERE slug='pain-fever' LIMIT 1;
  SELECT id INTO v_cold  FROM public.catalog_categories WHERE slug='cold-flu' LIMIT 1;
  SELECT id INTO v_vit   FROM public.catalog_categories WHERE slug='vitamins' LIMIT 1;
  SELECT id INTO v_skin  FROM public.catalog_categories WHERE slug='skin-care' LIMIT 1;
  SELECT id INTO v_baby  FROM public.catalog_categories WHERE slug='mother-baby' LIMIT 1;
  SELECT id INTO v_hyg   FROM public.catalog_categories WHERE slug='hygiene' LIMIT 1;
  SELECT id INTO v_dig   FROM public.catalog_categories WHERE slug='digestive' LIMIT 1;
  SELECT id INTO v_first FROM public.catalog_categories WHERE slug='first-aid' LIMIT 1;

  INSERT INTO public.catalog_products
    (organization_id, category_id, name_ar, name_en, generic_name, brand, dosage_form, strength,
     description_ar, active_ingredients, metadata, status, is_public, requires_prescription, pack_unit, sbdma_official_price)
  SELECT v_org, cat_id, ar, en, gen, br, form, str, desc_ar, '[]'::jsonb, '{}'::jsonb, 'approved', true, false, pu, price
  FROM (VALUES
    (v_pain,  'باراسيتامول 500 مجم','Paracetamol 500mg','Paracetamol','Panadol','قرص','500mg','مسكن للألم وخافض للحرارة، مناسب للصداع وآلام الجسم.','علبة 20 قرص',350::numeric),
    (v_pain,  'إيبوبروفين 400 مجم','Ibuprofen 400mg','Ibuprofen','Brufen','قرص','400mg','مضاد للالتهاب ومسكن قوي للآلام.','علبة 20 قرص',480),
    (v_cold,  'شراب للسعال','Cough Syrup','Dextromethorphan','Sedilix','شراب','100ml','يهدئ السعال الجاف ويريح الحلق.','زجاجة 100مل',620),
    (v_cold,  'أقراص للاحتقان','Cold Relief Tablets','Pseudoephedrine','Comtrex','قرص','30mg','يخفف احتقان الأنف وأعراض البرد.','علبة 12 قرص',540),
    (v_vit,   'فيتامين سي 1000','Vitamin C 1000','Ascorbic Acid','Redoxon','قرص فوار','1000mg','يعزز المناعة ويحمي من نزلات البرد.','أنبوب 20 قرص',890),
    (v_vit,   'فيتامين د3 1000 وحدة','Vitamin D3 1000IU','Cholecalciferol','Devarol','كبسولة','1000IU','يقوي العظام ويعالج نقص فيتامين د.','علبة 30 كبسولة',1250),
    (v_skin,  'كريم مرطب للوجه','Moisturizing Face Cream','Ceramides','CeraVe','كريم','50ml','يرطب البشرة الجافة ويحمي حاجزها.','أنبوب 50مل',2400),
    (v_skin,  'واقي شمس SPF 50','Sunscreen SPF 50','Titanium Dioxide','La Roche-Posay','لوشن','50ml','حماية عالية من أشعة الشمس UVA/UVB.','أنبوب 50مل',3800),
    (v_baby,  'حفاضات أطفال مقاس M','Baby Diapers Size M',NULL,'Pampers','حفاض','M','حفاضات ناعمة وامتصاص عالي طوال اليوم.','عبوة 60 حفاض',4500),
    (v_hyg,   'غسول يد مطهر','Antibacterial Hand Wash',NULL,'Dettol','سائل','250ml','يقتل 99.9% من الجراثيم بلطف على اليدين.','زجاجة 250مل',650),
    (v_dig,   'حبوب لعسر الهضم','Antacid Tablets','Calcium Carbonate','Rennie','قرص للمضغ','680mg','يخفف الحموضة وحرقة المعدة سريعاً.','علبة 24 قرص',420),
    (v_first, 'لصقات جروح متنوعة','Wound Plasters Assorted',NULL,'Band-Aid','لصقة','متنوع','مجموعة لصقات بأحجام مختلفة للجروح الصغيرة.','علبة 40 لصقة',380)
  ) AS p(cat_id, ar, en, gen, br, form, str, desc_ar, pu, price)
  WHERE NOT EXISTS (SELECT 1 FROM public.catalog_products cp WHERE cp.name_en = p.en);
END $$;
