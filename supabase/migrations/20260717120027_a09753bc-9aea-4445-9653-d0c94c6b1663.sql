
-- Idempotent seed helper
INSERT INTO public.medical_entities (entity_type, slug, name_ar, name_en, synonyms) VALUES
-- SPECIALTIES
('SPECIALTY','cardiology','طب القلب','Cardiology', ARRAY['قلب','أمراض القلب']),
('SPECIALTY','endocrinology','الغدد الصماء','Endocrinology', ARRAY['غدد','سكري','هرمونات']),
('SPECIALTY','dermatology','الجلدية','Dermatology', ARRAY['جلد','أمراض جلدية']),
('SPECIALTY','gastroenterology','الجهاز الهضمي','Gastroenterology', ARRAY['معدة','هضم']),
('SPECIALTY','neurology','المخ والأعصاب','Neurology', ARRAY['أعصاب','عصبية']),
('SPECIALTY','orthopedics','العظام','Orthopedics', ARRAY['عظام','مفاصل']),
('SPECIALTY','pediatrics','الأطفال','Pediatrics', ARRAY['أطفال']),
('SPECIALTY','ophthalmology','العيون','Ophthalmology', ARRAY['عيون','بصر']),
('SPECIALTY','ent','أنف وأذن وحنجرة','ENT', ARRAY['أنف','أذن','حنجرة']),
('SPECIALTY','psychiatry','الطب النفسي','Psychiatry', ARRAY['نفسي']),
('SPECIALTY','pulmonology','الصدرية','Pulmonology', ARRAY['صدر','رئة']),
('SPECIALTY','urology','المسالك البولية','Urology', ARRAY['مسالك','كلى']),
('SPECIALTY','gynecology','النساء والتوليد','Gynecology', ARRAY['نساء','ولادة']),
('SPECIALTY','dental','الأسنان','Dentistry', ARRAY['أسنان']),
('SPECIALTY','internal_medicine','الباطنية','Internal Medicine', ARRAY['باطنة']),
('SPECIALTY','general_practice','طب عام','General Practice', ARRAY['عام','ممارس عام']),
('SPECIALTY','allergy','الحساسية والمناعة','Allergy & Immunology', ARRAY['حساسية']),
('SPECIALTY','oncology','الأورام','Oncology', ARRAY['أورام','سرطان']),
('SPECIALTY','nephrology','الكلى','Nephrology', ARRAY['كلى']),
('SPECIALTY','rheumatology','الروماتيزم','Rheumatology', ARRAY['روماتيزم']),
('SPECIALTY','infectious_disease','الأمراض المعدية','Infectious Disease', ARRAY['معدية']),
('SPECIALTY','emergency','طوارئ','Emergency Medicine', ARRAY['طوارئ','إسعاف']),
-- SYMPTOMS
('SYMPTOM','headache','صداع','Headache', ARRAY['وجع رأس','ألم رأس']),
('SYMPTOM','fever','حمى','Fever', ARRAY['حرارة','سخونة']),
('SYMPTOM','cough','سعال','Cough', ARRAY['كحة']),
('SYMPTOM','sore_throat','التهاب حلق','Sore Throat', ARRAY['حلق','ألم بلع']),
('SYMPTOM','runny_nose','رشح','Runny Nose', ARRAY['زكام','سيلان أنف']),
('SYMPTOM','shortness_of_breath','ضيق تنفس','Shortness of Breath', ARRAY['كتمة','ضيق نفس']),
('SYMPTOM','chest_pain','ألم صدر','Chest Pain', ARRAY['وجع صدر']),
('SYMPTOM','abdominal_pain','ألم بطن','Abdominal Pain', ARRAY['مغص','وجع بطن']),
('SYMPTOM','nausea','غثيان','Nausea', ARRAY['رغبة تقيؤ']),
('SYMPTOM','vomiting','تقيؤ','Vomiting', ARRAY['استفراغ','قيء']),
('SYMPTOM','diarrhea','إسهال','Diarrhea', ARRAY['إسهال']),
('SYMPTOM','constipation','إمساك','Constipation', ARRAY['إمساك']),
('SYMPTOM','fatigue','تعب','Fatigue', ARRAY['إرهاق','خمول']),
('SYMPTOM','dizziness','دوخة','Dizziness', ARRAY['دوار']),
('SYMPTOM','joint_pain','ألم مفاصل','Joint Pain', ARRAY['وجع مفاصل']),
('SYMPTOM','back_pain','ألم ظهر','Back Pain', ARRAY['وجع ظهر']),
('SYMPTOM','rash','طفح جلدي','Skin Rash', ARRAY['طفح','حبوب','بقع جلدية']),
('SYMPTOM','itching','حكة','Itching', ARRAY['حكة','هرش']),
('SYMPTOM','frequent_urination','كثرة تبول','Frequent Urination', ARRAY['كثرة بول']),
('SYMPTOM','thirst','عطش','Excessive Thirst', ARRAY['عطش شديد']),
('SYMPTOM','weight_loss','فقدان وزن','Weight Loss', ARRAY['نقص وزن']),
('SYMPTOM','weight_gain','زيادة وزن','Weight Gain', ARRAY['بدانة']),
('SYMPTOM','palpitations','خفقان','Palpitations', ARRAY['خفقان قلب']),
('SYMPTOM','vision_blur','تشوش رؤية','Blurred Vision', ARRAY['ضعف نظر']),
('SYMPTOM','ear_pain','ألم أذن','Ear Pain', ARRAY['وجع أذن']),
('SYMPTOM','toothache','ألم أسنان','Toothache', ARRAY['وجع أسنان']),
('SYMPTOM','anxiety','قلق','Anxiety', ARRAY['توتر']),
('SYMPTOM','depression','اكتئاب','Depression', ARRAY['حزن مستمر']),
('SYMPTOM','insomnia','أرق','Insomnia', ARRAY['قلة نوم']),
('SYMPTOM','muscle_pain','ألم عضلات','Muscle Pain', ARRAY['وجع عضلات']),
('SYMPTOM','blood_pressure_high','ارتفاع ضغط','High Blood Pressure', ARRAY['ضغط عالي']),
-- DISEASES
('DISEASE','hypertension','ارتفاع ضغط الدم','Hypertension', ARRAY['ضغط الدم']),
('DISEASE','diabetes_t2','السكري النوع الثاني','Type 2 Diabetes', ARRAY['سكري']),
('DISEASE','diabetes_t1','السكري النوع الأول','Type 1 Diabetes', ARRAY['سكري أطفال']),
('DISEASE','asthma','الربو','Asthma', ARRAY['ربو']),
('DISEASE','migraine','الشقيقة','Migraine', ARRAY['صداع نصفي']),
('DISEASE','gerd','ارتجاع المريء','GERD', ARRAY['حموضة','ارتجاع']),
('DISEASE','ibs','القولون العصبي','IBS', ARRAY['قولون']),
('DISEASE','uti','التهاب المسالك البولية','Urinary Tract Infection', ARRAY['التهاب بولي']),
('DISEASE','pharyngitis','التهاب البلعوم','Pharyngitis', ARRAY['التهاب حلق']),
('DISEASE','common_cold','الزكام','Common Cold', ARRAY['برد']),
('DISEASE','influenza','الإنفلونزا','Influenza', ARRAY['نزلة برد']),
('DISEASE','covid19','كوفيد-19','COVID-19', ARRAY['كورونا']),
('DISEASE','anemia_iron','فقر الدم الحديدي','Iron Deficiency Anemia', ARRAY['فقر دم']),
('DISEASE','hypothyroidism','قصور الغدة الدرقية','Hypothyroidism', ARRAY['خمول الدرقية']),
('DISEASE','hyperthyroidism','فرط الغدة الدرقية','Hyperthyroidism', ARRAY['نشاط الدرقية']),
('DISEASE','depression_disorder','الاكتئاب','Major Depression', ARRAY['اكتئاب']),
('DISEASE','anxiety_disorder','اضطراب القلق','Anxiety Disorder', ARRAY['قلق مرضي']),
('DISEASE','osteoarthritis','خشونة المفاصل','Osteoarthritis', ARRAY['خشونة']),
('DISEASE','ra','التهاب المفاصل الروماتويدي','Rheumatoid Arthritis', ARRAY['روماتويد']),
('DISEASE','eczema','الأكزيما','Eczema', ARRAY['أكزيما']),
('DISEASE','acne','حب الشباب','Acne', ARRAY['حبوب شباب']),
('DISEASE','otitis_media','التهاب الأذن الوسطى','Otitis Media', ARRAY['التهاب أذن']),
('DISEASE','sinusitis','التهاب الجيوب','Sinusitis', ARRAY['جيوب أنفية']),
('DISEASE','gastritis','التهاب المعدة','Gastritis', ARRAY['التهاب معدة']),
('DISEASE','peptic_ulcer','قرحة المعدة','Peptic Ulcer', ARRAY['قرحة']),
('DISEASE','hepatitis_b','التهاب الكبد B','Hepatitis B', ARRAY['كبد B']),
('DISEASE','ckd','مرض الكلى المزمن','Chronic Kidney Disease', ARRAY['فشل كلوي']),
('DISEASE','malaria','الملاريا','Malaria', ARRAY['ملاريا']),
('DISEASE','typhoid','التيفوئيد','Typhoid', ARRAY['تيفوئيد']),
('DISEASE','dengue','حمى الضنك','Dengue Fever', ARRAY['ضنك']),
-- MEDICINES
('MEDICINE','paracetamol','باراسيتامول','Paracetamol', ARRAY['بنادول','أسيتامينوفين']),
('MEDICINE','ibuprofen','إيبوبروفين','Ibuprofen', ARRAY['بروفين']),
('MEDICINE','aspirin','أسبرين','Aspirin', ARRAY['أسبرين']),
('MEDICINE','amoxicillin','أموكسيسيلين','Amoxicillin', ARRAY['أموكسيل']),
('MEDICINE','azithromycin','أزيثرومايسين','Azithromycin', ARRAY['زيثرو']),
('MEDICINE','ciprofloxacin','سيبروفلوكساسين','Ciprofloxacin', ARRAY['سيبرو']),
('MEDICINE','metformin','ميتفورمين','Metformin', ARRAY['جلوكوفاج']),
('MEDICINE','glibenclamide','جليبنكلاميد','Glibenclamide', ARRAY['دايونيل']),
('MEDICINE','insulin','إنسولين','Insulin', ARRAY['أنسولين']),
('MEDICINE','amlodipine','أملوديبين','Amlodipine', ARRAY['نورفاسك']),
('MEDICINE','atenolol','أتينولول','Atenolol', ARRAY['تينورمين']),
('MEDICINE','lisinopril','ليزينوبريل','Lisinopril', ARRAY['زيستريل']),
('MEDICINE','losartan','لوسارتان','Losartan', ARRAY['كوزار']),
('MEDICINE','hydrochlorothiazide','هيدروكلوروثيازيد','Hydrochlorothiazide', ARRAY['HCT']),
('MEDICINE','omeprazole','أوميبرازول','Omeprazole', ARRAY['أوميز','لوسك']),
('MEDICINE','ranitidine','رانيتيدين','Ranitidine', ARRAY['زانتاك']),
('MEDICINE','loratadine','لوراتادين','Loratadine', ARRAY['كلاريتين']),
('MEDICINE','cetirizine','سيتيريزين','Cetirizine', ARRAY['زيرتك']),
('MEDICINE','salbutamol','سالبوتامول','Salbutamol', ARRAY['فينتولين']),
('MEDICINE','levothyroxine','ليفوثيروكسين','Levothyroxine', ARRAY['التروكسين']),
('MEDICINE','warfarin','وارفارين','Warfarin', ARRAY['مميع دم']),
('MEDICINE','clopidogrel','كلوبيدوجريل','Clopidogrel', ARRAY['بلافيكس']),
('MEDICINE','simvastatin','سيمفاستاتين','Simvastatin', ARRAY['زوكور']),
('MEDICINE','atorvastatin','أتورفاستاتين','Atorvastatin', ARRAY['ليبيتور']),
('MEDICINE','diclofenac','ديكلوفيناك','Diclofenac', ARRAY['فولتارين']),
('MEDICINE','tramadol','ترامادول','Tramadol', ARRAY['ترامال']),
('MEDICINE','prednisolone','بريدنيزولون','Prednisolone', ARRAY['كورتيزون']),
('MEDICINE','artemether_lumefantrine','أرتيميثر-لوميفانترين','Artemether-Lumefantrine', ARRAY['كوارتم']),
('MEDICINE','chloroquine','كلوروكين','Chloroquine', ARRAY['كلوروكين']),
('MEDICINE','ors','محلول الجفاف','ORS', ARRAY['محلول ملح']),
('MEDICINE','iron_sulfate','كبريتات الحديد','Iron Sulfate', ARRAY['حديد']),
('MEDICINE','folic_acid','حمض الفوليك','Folic Acid', ARRAY['فوليك']),
('MEDICINE','vitamin_d3','فيتامين د3','Vitamin D3', ARRAY['فيتامين د']),
('MEDICINE','vitamin_b12','فيتامين ب12','Vitamin B12', ARRAY['ب12']),
('MEDICINE','metronidazole','ميترونيدازول','Metronidazole', ARRAY['فلاجيل']),
('MEDICINE','ceftriaxone','سيفترياكسون','Ceftriaxone', ARRAY['روسيفين']),
('MEDICINE','fluconazole','فلوكونازول','Fluconazole', ARRAY['ديفلوكان']),
('MEDICINE','acyclovir','أسيكلوفير','Acyclovir', ARRAY['زوفيراكس']),
('MEDICINE','sertraline','سيرترالين','Sertraline', ARRAY['زولوفت']),
('MEDICINE','fluoxetine','فلوكستين','Fluoxetine', ARRAY['بروزاك'])
ON CONFLICT (entity_type, slug) DO NOTHING;

-- Symptom → Specialty (specialist_for)
WITH pairs(sym, spec) AS (VALUES
 ('chest_pain','cardiology'),('palpitations','cardiology'),('blood_pressure_high','cardiology'),
 ('shortness_of_breath','pulmonology'),('cough','pulmonology'),
 ('headache','neurology'),('dizziness','neurology'),
 ('abdominal_pain','gastroenterology'),('nausea','gastroenterology'),('vomiting','gastroenterology'),
 ('diarrhea','gastroenterology'),('constipation','gastroenterology'),
 ('joint_pain','orthopedics'),('back_pain','orthopedics'),('muscle_pain','orthopedics'),
 ('rash','dermatology'),('itching','dermatology'),
 ('frequent_urination','endocrinology'),('thirst','endocrinology'),('weight_loss','endocrinology'),
 ('weight_gain','endocrinology'),
 ('vision_blur','ophthalmology'),
 ('ear_pain','ent'),('sore_throat','ent'),('runny_nose','ent'),
 ('toothache','dental'),
 ('anxiety','psychiatry'),('depression','psychiatry'),('insomnia','psychiatry'),
 ('fever','general_practice'),('fatigue','general_practice')
)
INSERT INTO public.medical_relationships (source_id, target_id, relationship_type, confidence, evidence_source)
SELECT s.id, t.id, 'specialist_for', 0.85, 'curated_seed'
FROM pairs p
JOIN public.medical_entities s ON s.entity_type='SYMPTOM' AND s.slug=p.sym
JOIN public.medical_entities t ON t.entity_type='SPECIALTY' AND t.slug=p.spec
ON CONFLICT DO NOTHING;

-- Disease → Symptom (symptom_of, reverse edge from symptom perspective)
WITH pairs(dis, sym) AS (VALUES
 ('hypertension','headache'),('hypertension','dizziness'),('hypertension','blood_pressure_high'),
 ('diabetes_t2','thirst'),('diabetes_t2','frequent_urination'),('diabetes_t2','fatigue'),('diabetes_t2','weight_loss'),
 ('diabetes_t1','thirst'),('diabetes_t1','weight_loss'),('diabetes_t1','fatigue'),
 ('asthma','cough'),('asthma','shortness_of_breath'),
 ('migraine','headache'),('migraine','nausea'),('migraine','vision_blur'),
 ('gerd','chest_pain'),('gerd','nausea'),
 ('ibs','abdominal_pain'),('ibs','diarrhea'),('ibs','constipation'),
 ('uti','frequent_urination'),('uti','abdominal_pain'),
 ('pharyngitis','sore_throat'),('pharyngitis','fever'),
 ('common_cold','runny_nose'),('common_cold','cough'),('common_cold','sore_throat'),
 ('influenza','fever'),('influenza','muscle_pain'),('influenza','cough'),
 ('covid19','fever'),('covid19','cough'),('covid19','fatigue'),('covid19','shortness_of_breath'),
 ('anemia_iron','fatigue'),('anemia_iron','dizziness'),
 ('hypothyroidism','fatigue'),('hypothyroidism','weight_gain'),
 ('hyperthyroidism','palpitations'),('hyperthyroidism','weight_loss'),
 ('depression_disorder','depression'),('depression_disorder','insomnia'),('depression_disorder','fatigue'),
 ('anxiety_disorder','anxiety'),('anxiety_disorder','palpitations'),('anxiety_disorder','insomnia'),
 ('osteoarthritis','joint_pain'),('ra','joint_pain'),
 ('eczema','itching'),('eczema','rash'),
 ('acne','rash'),
 ('otitis_media','ear_pain'),('otitis_media','fever'),
 ('sinusitis','headache'),('sinusitis','runny_nose'),
 ('gastritis','abdominal_pain'),('peptic_ulcer','abdominal_pain'),
 ('malaria','fever'),('malaria','headache'),('malaria','muscle_pain'),
 ('typhoid','fever'),('typhoid','abdominal_pain'),
 ('dengue','fever'),('dengue','muscle_pain'),('dengue','headache')
)
INSERT INTO public.medical_relationships (source_id, target_id, relationship_type, confidence, evidence_source)
SELECT s.id, t.id, 'symptom_of', 0.8, 'curated_seed'
FROM pairs p
JOIN public.medical_entities s ON s.entity_type='SYMPTOM' AND s.slug=p.sym
JOIN public.medical_entities t ON t.entity_type='DISEASE' AND t.slug=p.dis
ON CONFLICT DO NOTHING;

-- Medicine → Disease (treats)
WITH pairs(med, dis) AS (VALUES
 ('paracetamol','common_cold'),('paracetamol','influenza'),('paracetamol','migraine'),
 ('ibuprofen','migraine'),('ibuprofen','osteoarthritis'),('ibuprofen','ra'),
 ('amoxicillin','pharyngitis'),('amoxicillin','otitis_media'),('amoxicillin','sinusitis'),
 ('azithromycin','pharyngitis'),('ciprofloxacin','uti'),
 ('metformin','diabetes_t2'),('glibenclamide','diabetes_t2'),('insulin','diabetes_t1'),('insulin','diabetes_t2'),
 ('amlodipine','hypertension'),('atenolol','hypertension'),('lisinopril','hypertension'),
 ('losartan','hypertension'),('hydrochlorothiazide','hypertension'),
 ('omeprazole','gerd'),('omeprazole','peptic_ulcer'),('omeprazole','gastritis'),
 ('ranitidine','gerd'),
 ('loratadine','eczema'),('cetirizine','eczema'),
 ('salbutamol','asthma'),
 ('levothyroxine','hypothyroidism'),
 ('simvastatin','hypertension'),('atorvastatin','hypertension'),
 ('artemether_lumefantrine','malaria'),('chloroquine','malaria'),
 ('ors','ibs'),('iron_sulfate','anemia_iron'),('folic_acid','anemia_iron'),
 ('sertraline','depression_disorder'),('fluoxetine','depression_disorder'),
 ('sertraline','anxiety_disorder'),
 ('ceftriaxone','typhoid')
)
INSERT INTO public.medical_relationships (source_id, target_id, relationship_type, confidence, evidence_source)
SELECT s.id, t.id, 'treats', 0.85, 'curated_seed'
FROM pairs p
JOIN public.medical_entities s ON s.entity_type='MEDICINE' AND s.slug=p.med
JOIN public.medical_entities t ON t.entity_type='DISEASE' AND t.slug=p.dis
ON CONFLICT DO NOTHING;

-- Drug interactions (drug_a_id < drug_b_id enforced by CHECK; resolve at write time)
WITH pairs(a, b, sev, mech, effect_ar, rec_ar) AS (VALUES
 ('warfarin','aspirin','major','Additive antiplatelet + anticoagulant','زيادة خطر النزيف','تجنّب الجمع؛ إن لزم راقب INR بدقة'),
 ('warfarin','ibuprofen','major','NSAID + anticoagulant','نزيف معدي/معوي','استخدم باراسيتامول بديلاً'),
 ('warfarin','clopidogrel','major','Combined anticoagulation','نزيف شديد','يتطلب متابعة طبية دقيقة'),
 ('aspirin','clopidogrel','moderate','Dual antiplatelet','زيادة نزيف','استخدم فقط بإشراف طبيب قلب'),
 ('aspirin','ibuprofen','moderate','Competitive COX-1 inhibition','قد يقلل تأثير حماية الأسبرين للقلب','افصل بين الجرعتين'),
 ('metformin','ciprofloxacin','moderate','Altered glucose control','تقلبات سكر الدم','راقب سكر الدم'),
 ('metformin','glibenclamide','moderate','Additive hypoglycemia','هبوط سكر','ابدأ بجرعات صغيرة'),
 ('atenolol','amlodipine','moderate','Additive hypotension/bradycardia','هبوط ضغط','راقب الضغط والنبض'),
 ('lisinopril','losartan','major','Dual RAAS blockade','ارتفاع بوتاسيوم وفشل كلوي','تجنّب الجمع'),
 ('lisinopril','hydrochlorothiazide','minor','Common combination','تآزر خافض للضغط','تركيبة معتمدة'),
 ('losartan','hydrochlorothiazide','minor','Common combination','تآزر خافض للضغط','تركيبة معتمدة'),
 ('simvastatin','clopidogrel','moderate','CYP interactions','قد يقلل فعالية كلوبيدوجريل','فضّل أتورفاستاتين'),
 ('simvastatin','amlodipine','moderate','CYP3A4 inhibition','زيادة تركيز سيمفاستاتين','لا تتجاوز 20mg سيمفاستاتين يومياً'),
 ('azithromycin','warfarin','moderate','Altered INR','زيادة نزيف','راقب INR'),
 ('ciprofloxacin','warfarin','major','Altered INR','زيادة نزيف','راقب INR بدقة'),
 ('fluconazole','warfarin','major','CYP2C9 inhibition','نزيف','راقب INR بشدة'),
 ('omeprazole','clopidogrel','moderate','Reduced clopidogrel activation','تقليل فعالية بلافيكس','فضّل بانتوبرازول'),
 ('sertraline','tramadol','major','Serotonin syndrome risk','متلازمة السيروتونين','تجنّب الجمع'),
 ('fluoxetine','tramadol','major','Serotonin syndrome risk','متلازمة السيروتونين','تجنّب الجمع'),
 ('sertraline','warfarin','moderate','Increased bleeding risk','نزيف','راقب INR'),
 ('prednisolone','ibuprofen','moderate','GI ulceration risk','قرحة/نزيف','أضف واقياً للمعدة'),
 ('prednisolone','warfarin','moderate','Altered anticoagulation','زيادة نزيف','راقب INR')
)
INSERT INTO public.drug_interactions (drug_a_id, drug_b_id, severity, mechanism, clinical_effect_ar, recommendation_ar, evidence_source)
SELECT
  LEAST(a.id, b.id), GREATEST(a.id, b.id),
  p.sev, p.mech, p.effect_ar, p.rec_ar, 'curated_seed'
FROM pairs p
JOIN public.medical_entities a ON a.entity_type='MEDICINE' AND a.slug=p.a
JOIN public.medical_entities b ON b.entity_type='MEDICINE' AND b.slug=p.b
WHERE a.id <> b.id
ON CONFLICT DO NOTHING;
