-- MUSLLY AI OS - Supabase Schema
-- Healthcare Operating System for Yemen

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- Users & Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  avatar TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('super_admin', 'admin', 'pharmacist', 'doctor', 'nurse', 'inventory_manager', 'delivery_driver', 'customer', 'guest')),
  branch_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  manager_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  is_main BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products / Medicines
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  barcode TEXT UNIQUE,
  sku TEXT UNIQUE,
  image TEXT,
  images TEXT[],
  manufacturer TEXT,
  country TEXT,
  active_ingredient TEXT,
  dosage TEXT,
  contraindications TEXT[],
  side_effects TEXT[],
  pregnancy_category TEXT,
  prescription_required BOOLEAN DEFAULT false,
  expiry_date DATE,
  fefo BOOLEAN DEFAULT true,
  branch_id UUID REFERENCES branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'returned')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  payment_method TEXT,
  total DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) NOT NULL,
  delivery_address JSONB,
  prescription_id UUID,
  notes TEXT,
  branch_id UUID REFERENCES branches(id),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  specialty TEXT NOT NULL,
  sub_specialty TEXT,
  license_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  education JSONB DEFAULT '[]',
  experience JSONB DEFAULT '[]',
  certificates JSONB DEFAULT '[]',
  clinics JSONB DEFAULT '[]',
  hospitals UUID[],
  rating DECIMAL(2,1) DEFAULT 5.0,
  review_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  languages TEXT[] DEFAULT '{"ar","en"}',
  consultation_fee DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hospitals
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT CHECK (type IN ('public', 'private', 'specialized')),
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  departments JSONB DEFAULT '[]',
  beds INTEGER DEFAULT 0,
  icu_beds INTEGER DEFAULT 0,
  operating_rooms INTEGER DEFAULT 0,
  emergency BOOLEAN DEFAULT false,
  ambulance_count INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  blood_type TEXT,
  allergies TEXT[],
  chronic_diseases TEXT[],
  medications TEXT[],
  emergency_contact JSONB,
  medical_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  doctor_name TEXT NOT NULL,
  doctor_license TEXT,
  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  patient_weight DECIMAL(5,2),
  diagnosis TEXT NOT NULL,
  medications JSONB NOT NULL DEFAULT '[]',
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  expiry_date DATE NOT NULL,
  fefo BOOLEAN DEFAULT true,
  warehouse_id UUID,
  branch_id UUID REFERENCES branches(id),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'expired', 'damaged', 'returned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouses
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  address TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id),
  capacity INTEGER NOT NULL,
  current_stock INTEGER DEFAULT 0,
  manager_id UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  driver_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
  route JSONB DEFAULT '[]',
  estimated_time TIMESTAMPTZ,
  actual_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT,
  type TEXT CHECK (type IN ('manufacturer', 'distributor', 'wholesaler')),
  country TEXT NOT NULL,
  address TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  tax_number TEXT,
  products UUID[],
  rating DECIMAL(2,1) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Transactions
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'YER',
  description TEXT NOT NULL,
  reference TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('email', 'sms', 'whatsapp', 'push', 'social')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
  audience JSONB DEFAULT '[]',
  content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Memory
CREATE TABLE ai_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('short', 'long', 'medical', 'business', 'customer', 'learning')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  importance DECIMAL(3,2) DEFAULT 0.5,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- AI Events
CREATE TABLE ai_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  source TEXT NOT NULL,
  target TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph
CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('drug', 'ingredient', 'disease', 'symptom', 'doctor', 'hospital', 'patient', 'interaction')),
  label TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES knowledge_nodes(id),
  target_id UUID REFERENCES knowledge_nodes(id),
  type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Records
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id),
  type TEXT NOT NULL CHECK (type IN ('visit', 'lab', 'imaging', 'prescription', 'surgery', 'vaccination')),
  date DATE NOT NULL,
  doctor_id UUID REFERENCES doctors(id),
  hospital_id UUID REFERENCES hospitals(id),
  diagnosis TEXT,
  notes TEXT,
  attachments TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES doctors(id),
  hospital_id UUID REFERENCES hospitals(id),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type TEXT CHECK (type IN ('consultation', 'follow_up', 'emergency', 'surgery')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own, admins can read all
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Products: Everyone can read active, admins can manage
CREATE POLICY "Everyone can read active products" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin', 'inventory_manager', 'pharmacist'));

-- Orders: Users can read own, admins can read all
CREATE POLICY "Users can read own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' IN ('admin', 'super_admin', 'pharmacist'));

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Doctors: Everyone can read verified
CREATE POLICY "Everyone can read verified doctors" ON doctors
  FOR SELECT USING (is_verified = true AND is_active = true);

CREATE POLICY "Admins can manage doctors" ON doctors
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

-- Hospitals: Everyone can read active
CREATE POLICY "Everyone can read active hospitals" ON hospitals
  FOR SELECT USING (is_active = true);

-- Patients: Users can read own, doctors can read assigned
CREATE POLICY "Users can read own patient record" ON patients
  FOR SELECT USING (auth.uid() = user_id);

-- Notifications: Users can read own
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create notification on new order
CREATE OR REPLACE FUNCTION create_order_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, priority)
  VALUES (
    NEW.user_id,
    'order_created',
    'طلب جديد',
    'تم إنشاء طلبك بنجاح رقم #' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'total', NEW.grand_total),
    'medium'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_created_notification AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION create_order_notification();

-- Low stock alert
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock <= NEW.min_stock THEN
    INSERT INTO notifications (type, title, message, data, priority)
    VALUES (
      'low_stock',
      'تنبيه مخزون منخفض',
      'المنتج ' || NEW.name_ar || ' وصل للحد الأدنى',
      jsonb_build_object('product_id', NEW.id, 'stock', NEW.stock),
      'high'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER low_stock_alert AFTER UPDATE ON products
  FOR EACH ROW WHEN (NEW.stock <= NEW.min_stock)
  EXECUTE FUNCTION check_low_stock();

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_branch ON products(branch_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_doctors_specialty ON doctors(specialty);
CREATE INDEX idx_patients_user ON patients(user_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date);
CREATE INDEX idx_ai_memory_user ON ai_memory(user_id);
CREATE INDEX idx_ai_memory_type ON ai_memory(type);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(type);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);

-- ============================================
-- SEED DATA
-- ============================================

-- Main Branch
INSERT INTO branches (name, name_ar, governorate, city, address, phone, is_main) VALUES
('Main Branch', 'الفرع الرئيسي', 'عدن', 'خور مكسر', 'شارع المعلا، مقابل مستشفى الجمهورية', '+967-777-000-000', true);

-- Demo Products
INSERT INTO products (name, name_ar, description, category, price, cost, stock, min_stock, barcode, manufacturer, country, active_ingredient, dosage, prescription_required) VALUES
('Panadol Extra', 'بانادول إكسترا', 'مسكن للألم وخافض للحرارة', 'مسكنات', 1500.00, 900.00, 500, 50, '622300000001', 'GSK', 'UK', 'Paracetamol + Caffeine', '500mg + 65mg', false),
('Amoxicillin 500mg', 'أموكسيسيلين 500 مجم', 'مضاد حيوي واسع الطيف', 'مضادات حيوية', 2500.00, 1500.00, 200, 30, '622300000002', 'Sandoz', 'Austria', 'Amoxicillin', '500mg', true),
('Omeprazole 20mg', 'أوميبرازول 20 مجم', 'مثبط لمضخة البروتون', 'مضادات حموضة', 1800.00, 1100.00, 350, 40, '622300000003', 'AstraZeneca', 'Sweden', 'Omeprazole', '20mg', false),
('Insulin Glargine', 'إنسولين جلارجين', 'إنسولين طويل المفعول', 'سكري', 8500.00, 6000.00, 80, 15, '622300000004', 'Sanofi', 'France', 'Insulin Glargine', '100 units/ml', true),
('Vitamin D3 5000IU', 'فيتامين د3 5000 وحدة', 'مكمل غذائي لفيتامين D', 'فيتامينات', 1200.00, 700.00, 600, 60, '622300000005', 'Nature Made', 'USA', 'Cholecalciferol', '5000 IU', false);

-- Demo Doctors
INSERT INTO doctors (name, name_ar, specialty, license_number, email, phone, bio, is_verified, rating) VALUES
('Dr. Ahmed Al-Masry', 'د. أحمد المصري', 'باطنية', 'YEM-DR-001', 'ahmed@doctor.ye', '+967-777-111-111', 'أخصائي أمراض باطنية بخبرة 15 سنة', true, 4.8),
('Dr. Fatima Hassan', 'د. فاطمة حسن', 'أطفال', 'YEM-DR-002', 'fatima@doctor.ye', '+967-777-222-222', 'أخصائية أمراض الأطفال والحديثي الولادة', true, 4.9),
('Dr. Mohammed Saleh', 'د. محمد صالح', 'جراحة', 'YEM-DR-003', 'mohammed@doctor.ye', '+967-777-333-333', 'جراح عام واستشاري جراحة المناظير', true, 4.7);

-- Demo Hospitals
INSERT INTO hospitals (name, name_ar, type, address, phone, beds, icu_beds, operating_rooms, emergency, ambulance_count) VALUES
('Al-Jumhuriya Hospital', 'مستشفى الجمهورية', 'public', 'خور مكسر، عدن', '+967-777-444-444', 200, 20, 8, true, 5),
('Al-Saeed Hospital', 'مستشفى السعيد', 'private', 'المعلا، عدن', '+967-777-555-555', 150, 15, 5, true, 3),
('Yemen-Swedish Hospital', 'مستشفى اليمن السويدي', 'specialized', 'المنصورة، عدن', '+967-777-666-666', 100, 10, 4, true, 2);
