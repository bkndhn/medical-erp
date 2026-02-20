export type Industry = 'grocery' | 'textile' | 'medical' | 'fruit' | 'custom';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  mrp: number;
  category: string;
  stock: number;
  unit: string;
  gstRate: number;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  total: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const industries: { id: Industry; label: string; icon: string; description: string }[] = [
  { id: 'grocery', label: 'Grocery', icon: '🛒', description: 'General store, supermarket, FMCG' },
  { id: 'textile', label: 'Textile', icon: '👔', description: 'Fashion, garments, fabrics' },
  { id: 'medical', label: 'Medical', icon: '💊', description: 'Pharmacy, clinic, medical store' },
  { id: 'fruit', label: 'Fruit & Produce', icon: '🍎', description: 'Fresh fruits, vegetables, perishables' },
  { id: 'custom', label: 'Custom', icon: '⚙️', description: 'Custom industry configuration' },
];

export const categories: Category[] = [
  { id: 'all', name: 'All Items', icon: '📦', color: 'primary' },
  { id: 'beverages', name: 'Beverages', icon: '🥤', color: 'accent' },
  { id: 'snacks', name: 'Snacks', icon: '🍿', color: 'success' },
  { id: 'dairy', name: 'Dairy', icon: '🥛', color: 'primary' },
  { id: 'personal', name: 'Personal Care', icon: '🧴', color: 'accent' },
  { id: 'household', name: 'Household', icon: '🏠', color: 'success' },
  { id: 'grains', name: 'Grains & Pulses', icon: '🌾', color: 'primary' },
  { id: 'frozen', name: 'Frozen Foods', icon: '🧊', color: 'accent' },
];

export const mockProducts: Product[] = [
  { id: '1', name: 'Amul Milk 500ml', sku: 'MLK001', barcode: '8901030000001', price: 28, mrp: 30, category: 'dairy', stock: 150, unit: 'pcs', gstRate: 5 },
  { id: '2', name: 'Britannia Bread', sku: 'BRD001', barcode: '8901030000002', price: 42, mrp: 45, category: 'snacks', stock: 80, unit: 'pcs', gstRate: 5 },
  { id: '3', name: 'Coca Cola 750ml', sku: 'BEV001', barcode: '8901030000003', price: 38, mrp: 40, category: 'beverages', stock: 200, unit: 'pcs', gstRate: 18 },
  { id: '4', name: 'Tata Salt 1kg', sku: 'GRN001', barcode: '8901030000004', price: 22, mrp: 25, category: 'grains', stock: 120, unit: 'pcs', gstRate: 5 },
  { id: '5', name: 'Surf Excel 1kg', sku: 'HH001', barcode: '8901030000005', price: 195, mrp: 210, category: 'household', stock: 60, unit: 'pcs', gstRate: 18 },
  { id: '6', name: 'Dove Soap 100g', sku: 'PC001', barcode: '8901030000006', price: 48, mrp: 52, category: 'personal', stock: 90, unit: 'pcs', gstRate: 18 },
  { id: '7', name: 'Pepsi 2L', sku: 'BEV002', barcode: '8901030000007', price: 85, mrp: 90, category: 'beverages', stock: 45, unit: 'pcs', gstRate: 18 },
  { id: '8', name: 'Maggi Noodles', sku: 'SNK001', barcode: '8901030000008', price: 14, mrp: 14, category: 'snacks', stock: 300, unit: 'pcs', gstRate: 12 },
  { id: '9', name: 'Amul Butter 100g', sku: 'DRY002', barcode: '8901030000009', price: 52, mrp: 56, category: 'dairy', stock: 70, unit: 'pcs', gstRate: 12 },
  { id: '10', name: 'Dettol Handwash', sku: 'PC002', barcode: '8901030000010', price: 99, mrp: 110, category: 'personal', stock: 55, unit: 'pcs', gstRate: 18 },
  { id: '11', name: 'Aashirvaad Atta 5kg', sku: 'GRN002', barcode: '8901030000011', price: 245, mrp: 260, category: 'grains', stock: 40, unit: 'pcs', gstRate: 5 },
  { id: '12', name: 'Parle-G Biscuit', sku: 'SNK002', barcode: '8901030000012', price: 10, mrp: 10, category: 'snacks', stock: 500, unit: 'pcs', gstRate: 5 },
  { id: '13', name: 'Mother Dairy Curd', sku: 'DRY003', barcode: '8901030000013', price: 30, mrp: 32, category: 'dairy', stock: 60, unit: 'pcs', gstRate: 5 },
  { id: '14', name: 'Vim Liquid 500ml', sku: 'HH002', barcode: '8901030000014', price: 95, mrp: 99, category: 'household', stock: 35, unit: 'pcs', gstRate: 18 },
  { id: '15', name: 'Frozen Peas 500g', sku: 'FRZ001', barcode: '8901030000015', price: 75, mrp: 80, category: 'frozen', stock: 25, unit: 'pcs', gstRate: 5 },
  { id: '16', name: 'Sprite 600ml', sku: 'BEV003', barcode: '8901030000016', price: 35, mrp: 38, category: 'beverages', stock: 180, unit: 'pcs', gstRate: 18 },
];

export const shortcutMap = [
  { key: 'F1', action: 'Search Products', category: 'Billing' },
  { key: 'F2', action: 'Add Manual Item', category: 'Billing' },
  { key: 'F3', action: 'Edit Quantity', category: 'Billing' },
  { key: 'F4', action: 'Edit Price', category: 'Billing' },
  { key: 'F5', action: 'Apply Discount', category: 'Billing' },
  { key: 'F6', action: 'Hold Bill', category: 'Billing' },
  { key: 'F7', action: 'Recall Held Bill', category: 'Billing' },
  { key: 'F8', action: 'Reprint Last Bill', category: 'Billing' },
  { key: 'F9', action: 'Open Payment', category: 'Billing' },
  { key: 'F12', action: 'Print & Complete', category: 'Billing' },
  { key: 'Enter', action: 'Confirm Payment', category: 'Payment' },
  { key: 'Tab', action: 'Switch Payment Mode', category: 'Payment' },
  { key: 'Ctrl+P', action: 'Sales Report', category: 'Navigation' },
  { key: 'Ctrl+I', action: 'Item Master', category: 'Navigation' },
  { key: 'Ctrl+C', action: 'Customer Search', category: 'Navigation' },
  { key: '?', action: 'Shortcut Help', category: 'General' },
  { key: 'Esc', action: 'Close / Cancel', category: 'General' },
];

export const dashboardStats = {
  todaySales: 48750,
  todayOrders: 127,
  avgOrderValue: 384,
  pendingOrders: 3,
  lowStockItems: 8,
  topProducts: [
    { name: 'Amul Milk', qty: 45, revenue: 1260 },
    { name: 'Maggi Noodles', qty: 38, revenue: 532 },
    { name: 'Coca Cola', qty: 32, revenue: 1216 },
    { name: 'Parle-G', qty: 28, revenue: 280 },
    { name: 'Bread', qty: 25, revenue: 1050 },
  ],
  hourlyData: [
    { hour: '9AM', sales: 2400 }, { hour: '10AM', sales: 4200 },
    { hour: '11AM', sales: 5800 }, { hour: '12PM', sales: 7200 },
    { hour: '1PM', sales: 6100 }, { hour: '2PM', sales: 4800 },
    { hour: '3PM', sales: 5500 }, { hour: '4PM', sales: 6900 },
    { hour: '5PM', sales: 3850 },
  ],
  recentSales: [
    { id: 'INV-1247', customer: 'Walk-in', amount: 342, time: '4:32 PM', items: 5 },
    { id: 'INV-1246', customer: 'Rahul S.', amount: 1280, time: '4:18 PM', items: 12 },
    { id: 'INV-1245', customer: 'Walk-in', amount: 89, time: '4:05 PM', items: 2 },
    { id: 'INV-1244', customer: 'Priya M.', amount: 567, time: '3:48 PM', items: 8 },
    { id: 'INV-1243', customer: 'Walk-in', amount: 210, time: '3:30 PM', items: 4 },
  ],
};
