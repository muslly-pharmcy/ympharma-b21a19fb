// Core Types for MUSLLY AI OS

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  phone?: string
  branchId?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'pharmacist' 
  | 'doctor' 
  | 'nurse'
  | 'inventory_manager'
  | 'delivery_driver'
  | 'customer'
  | 'guest'

export interface Planet {
  id: string
  name: string
  nameAr: string
  icon: string
  color: string
  description: string
  module: string
  stats?: PlanetStats
  isActive: boolean
  order: number
}

export interface PlanetStats {
  total: number
  active: number
  pending: number
  alerts: number
}

export interface AIAgent {
  id: string
  name: string
  nameAr: string
  role: string
  avatar: string
  status: 'active' | 'idle' | 'busy' | 'offline'
  capabilities: string[]
  lastActive: string
  tasksCompleted: number
}

export interface AIMemory {
  id: string
  type: 'short' | 'long' | 'medical' | 'business' | 'customer' | 'learning'
  content: string
  context: Record<string, unknown>
  importance: number
  createdAt: string
  expiresAt?: string
}

export interface AIEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  source: string
  target?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  processedAt?: string
}

export interface Product {
  id: string
  name: string
  nameAr: string
  description: string
  category: string
  subcategory?: string
  price: number
  cost: number
  stock: number
  minStock: number
  barcode: string
  sku: string
  image?: string
  images?: string[]
  manufacturer: string
  country: string
  activeIngredient?: string
  dosage?: string
  contraindications?: string[]
  sideEffects?: string[]
  pregnancyCategory?: string
  prescriptionRequired: boolean
  expiryDate?: string
  fefo?: boolean
  branchId?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: string
  total: number
  discount: number
  tax: number
  shipping: number
  grandTotal: number
  deliveryAddress?: Address
  prescription?: Prescription
  notes?: string
  branchId?: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'ready' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled' 
  | 'returned'

export type PaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'partially_refunded'

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
  total: number
}

export interface Address {
  id: string
  userId: string
  label: string
  street: string
  city: string
  governorate: string
  zipCode?: string
  phone: string
  isDefault: boolean
  lat?: number
  lng?: number
}

export interface Prescription {
  id: string
  orderId: string
  doctorName: string
  doctorLicense?: string
  patientName: string
  patientAge?: number
  patientWeight?: number
  diagnosis: string
  medications: PrescriptionItem[]
  imageUrl?: string
  status: 'pending' | 'approved' | 'rejected' | 'needs_review'
  reviewedBy?: string
  reviewedAt?: string
  notes?: string
  createdAt: string
}

export interface PrescriptionItem {
  medication: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

export interface Doctor {
  id: string
  name: string
  nameAr: string
  specialty: string
  subSpecialty?: string
  licenseNumber: string
  email: string
  phone: string
  avatar?: string
  bio?: string
  education: Education[]
  experience: Experience[]
  certificates: Certificate[]
  clinics: Clinic[]
  hospitals: string[]
  rating: number
  reviewCount: number
  isVerified: boolean
  isActive: boolean
  languages: string[]
  consultationFee?: number
  createdAt: string
}

export interface Education {
  degree: string
  institution: string
  year: number
  country: string
}

export interface Experience {
  position: string
  institution: string
  from: string
  to?: string
  current: boolean
}

export interface Certificate {
  name: string
  issuer: string
  year: number
  fileUrl?: string
}

export interface Clinic {
  id: string
  name: string
  address: string
  phone: string
  lat?: number
  lng?: number
  schedule: Schedule[]
}

export interface Schedule {
  day: string
  from: string
  to: string
  isAvailable: boolean
}

export interface Hospital {
  id: string
  name: string
  nameAr: string
  type: 'public' | 'private' | 'specialized'
  address: string
  phone: string
  email?: string
  lat?: number
  lng?: number
  departments: Department[]
  beds: number
  icuBeds: number
  operatingRooms: number
  emergency: boolean
  ambulanceCount: number
  rating: number
  isActive: boolean
  createdAt: string
}

export interface Department {
  id: string
  name: string
  head?: string
  doctors: string[]
  beds: number
  description?: string
}

export interface Patient {
  id: string
  userId: string
  name: string
  nameAr: string
  dateOfBirth?: string
  gender: 'male' | 'female' | 'other'
  bloodType?: string
  allergies?: string[]
  chronicDiseases?: string[]
  medications?: string[]
  emergencyContact?: EmergencyContact
  medicalHistory: MedicalRecord[]
  createdAt: string
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface MedicalRecord {
  id: string
  type: 'visit' | 'lab' | 'imaging' | 'prescription' | 'surgery' | 'vaccination'
  date: string
  doctorId?: string
  hospitalId?: string
  diagnosis?: string
  notes?: string
  attachments?: string[]
  createdAt: string
}

export interface InventoryItem {
  id: string
  productId: string
  batchNumber: string
  quantity: number
  unitCost: number
  expiryDate: string
  fefo: boolean
  warehouseId: string
  branchId: string
  status: 'available' | 'reserved' | 'expired' | 'damaged' | 'returned'
  createdAt: string
}

export interface Warehouse {
  id: string
  name: string
  nameAr: string
  address: string
  branchId: string
  capacity: number
  currentStock: number
  managerId?: string
  isActive: boolean
  createdAt: string
}

export interface Delivery {
  id: string
  orderId: string
  driverId: string
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed'
  route?: RoutePoint[]
  estimatedTime?: string
  actualTime?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RoutePoint {
  lat: number
  lng: number
  timestamp: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  isRead: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
}

export interface AnalyticsDashboard {
  revenue: Metric
  orders: Metric
  customers: Metric
  products: Metric
  topProducts: TopProduct[]
  recentOrders: Order[]
  alerts: Alert[]
}

export interface Metric {
  value: number
  change: number
  changeType: 'increase' | 'decrease' | 'neutral'
  period: string
}

export interface TopProduct {
  productId: string
  name: string
  sales: number
  revenue: number
}

export interface Alert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  action?: string
  createdAt: string
}

export interface KnowledgeNode {
  id: string
  type: 'drug' | 'ingredient' | 'disease' | 'symptom' | 'doctor' | 'hospital' | 'patient' | 'interaction'
  label: string
  properties: Record<string, unknown>
  relationships: KnowledgeRelationship[]
}

export interface KnowledgeRelationship {
  type: string
  targetId: string
  properties?: Record<string, unknown>
}

export interface Theme {
  mode: 'light' | 'dark' | 'system'
  primary: string
  secondary: string
  accent: string
}

export interface Branch {
  id: string
  name: string
  nameAr: string
  governorate: string
  city: string
  address: string
  phone: string
  email?: string
  lat?: number
  lng?: number
  managerId?: string
  isActive: boolean
  isMain: boolean
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  nameAr: string
  type: 'manufacturer' | 'distributor' | 'wholesaler'
  country: string
  address?: string
  phone: string
  email?: string
  taxNumber?: string
  products: string[]
  rating: number
  isActive: boolean
  createdAt: string
}

export interface FinancialTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  category: string
  amount: number
  currency: string
  description: string
  reference?: string
  branchId?: string
  createdBy: string
  createdAt: string
}

export interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms' | 'whatsapp' | 'push' | 'social'
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
  audience: string[]
  content: string
  scheduledAt?: string
  sentAt?: string
  deliveredCount: number
  openCount: number
  clickCount: number
  createdAt: string
}
