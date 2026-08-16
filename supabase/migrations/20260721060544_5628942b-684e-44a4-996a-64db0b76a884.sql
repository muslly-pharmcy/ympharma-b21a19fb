
INSERT INTO public.catalog_categories (slug, name_ar, name_en, is_active, sort_order, organization_id)
SELECT 'womens-care', 'عناية المرأة والتجميل', 'Women''s Care & Beauty', true, 10, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_categories WHERE slug='womens-care' AND organization_id IS NULL
);

WITH cat AS (
  SELECT id FROM public.catalog_categories WHERE slug='womens-care' AND organization_id IS NULL LIMIT 1
), items(store_code, name_ar, name_en, brand, description_ar) AS (
  VALUES
    ('WC-NOW-VITC1000', 'فيتامين سي 1000 ملغ - ناو فودز', 'NOW Vitamin C-1000', 'NOW Foods', 'مكمل غذائي لدعم المناعة والبشرة.'),
    ('WC-NOW-BIOTIN', 'بيوتين 10000 مكغ - ناو فودز', 'NOW Biotin 10000mcg', 'NOW Foods', 'يدعم صحة الشعر والأظافر والبشرة.'),
    ('WC-NOW-COLLAGEN', 'ببتيدات الكولاجين - ناو فودز', 'NOW Collagen Peptides', 'NOW Foods', 'كولاجين لصحة البشرة والمفاصل.'),
    ('WC-NOW-HSN', 'فيتامين الشعر والبشرة والأظافر - ناو', 'NOW Hair, Skin & Nails', 'NOW Foods', 'تركيبة متكاملة للجمال الطبيعي.'),
    ('WC-IHRB-HA', 'سيروم حمض الهيالورونيك - آي هيرب', 'Hyaluronic Acid Serum', 'iHerb Select', 'سيروم مرطّب يمنح البشرة نضارة فورية.'),
    ('WC-IHRB-VITC', 'سيروم فيتامين سي - آي هيرب', 'Vitamin C Serum', 'iHerb Select', 'يوحّد لون البشرة ويقلل التصبغات.'),
    ('WC-IHRB-RETINOL', 'سيروم الريتينول - آي هيرب', 'Retinol Anti-Aging Serum', 'iHerb Select', 'مضاد للشيخوخة وينشّط تجديد الخلايا.'),
    ('WC-IHRB-NIACIN', 'سيروم النياسيناميد 10% - آي هيرب', 'Niacinamide 10% Serum', 'iHerb Select', 'يقلل المسام ويوازن إفراز الدهون.'),
    ('WC-CERAVE-MC', 'كريم مرطب سيرافي', 'CeraVe Moisturizing Cream', 'CeraVe', 'مرطب يومي للبشرة الجافة والحساسة.'),
    ('WC-LRP-TOLER', 'مرطب لاروش بوزيه توليران', 'La Roche-Posay Toleriane', 'La Roche-Posay', 'مرطب للبشرة الحساسة.'),
    ('WC-BIODERMA-H2O', 'ماء ميسيلار بيوديرما سنسيبيو', 'Bioderma Sensibio H2O', 'Bioderma', 'مزيل مكياج لطيف للبشرة الحساسة.'),
    ('WC-NEUT-HYDRO', 'جل نيوتروجينا هيدرو بوست', 'Neutrogena Hydro Boost Gel', 'Neutrogena', 'مرطب مائي بحمض الهيالورونيك.'),
    ('WC-ORDINARY-AHA', 'ذا اورديناري AHA 30% + BHA 2% بيلينج', 'The Ordinary AHA 30% + BHA 2%', 'The Ordinary', 'تقشير كيميائي أسبوعي لتجديد البشرة.'),
    ('WC-NOW-EPO', 'زيت زهرة الربيع المسائية - ناو', 'NOW Evening Primrose Oil', 'NOW Foods', 'داعم للتوازن الهرموني وصحة البشرة.'),
    ('WC-NOW-FOLIC', 'حمض الفوليك 800 مكغ - ناو', 'NOW Folic Acid 800mcg', 'NOW Foods', 'مكمل أساسي للنساء في سن الإنجاب.')
)
INSERT INTO public.catalog_products
  (store_code, name_ar, name_en, brand, description_ar, category_id, status, is_public, requires_prescription)
SELECT i.store_code, i.name_ar, i.name_en, i.brand, i.description_ar, cat.id, 'approved', true, false
FROM items i CROSS JOIN cat
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_products p WHERE p.store_code = i.store_code);

INSERT INTO public.inv_stock_batches
  (organization_id, warehouse_id, product_id, batch_no, qty_on_hand, qty_reserved, expiry_date, received_at)
SELECT
  '11111111-1111-1111-1111-000000000001'::uuid,
  '22222222-2222-2222-2222-000000000001'::uuid,
  p.id, 'WOMENS-INIT', 10, 0, (now() + interval '18 months')::date, now()
FROM public.catalog_products p
JOIN public.catalog_categories c ON c.id = p.category_id
WHERE c.slug = 'womens-care'
  AND NOT EXISTS (SELECT 1 FROM public.inv_stock_batches b WHERE b.product_id = p.id AND b.batch_no = 'WOMENS-INIT');
